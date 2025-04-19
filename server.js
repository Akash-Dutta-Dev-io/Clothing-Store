const express = require('express');
const connectMongo = require('./database/db');
const User = require('./models/User');
const Cart = require('./models/Cart');
const Order = require('./models/Order');
const Menu = require("./models/Menu");
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('./config/session');
const PDFDocument = require('pdfkit'); // Import PDF module
const fs = require('fs');
const path = require('path');
const multer = require("multer");


const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session); // uses session middleware
app.set('view engine', 'ejs');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        return next();
    }
    res.redirect("/menu"); // Redirect non-admins
}



// Home Page
app.get('/', async (req, res) => {
    const menu = await Menu.find();
    res.render("index", {menu});
    // res.render('index');
});

// Register Page
app.get('/register', (req, res) => {
    res.render('register');
});

app.post("/register", async (req, res) => {
    const { username, password, adminSecret } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return res.send("Try another username");
    }

    const isAdmin = adminSecret === "Akash"; // Change this to a secure key

    const newUser = new User({ username, password: hashedPassword, isAdmin });
    await newUser.save();
    
    res.redirect("/login");
});


// Login Page
app.get('/login', (req, res) => {
    res.render('login');
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.send("Invalid username or password");
    }

    req.session.user = { username: user.username, isAdmin: user.isAdmin };
    
    res.redirect(user.isAdmin ? "/admin" : "/menu"); // Redirect admins to dashboard
});

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

const upload = multer({ storage: storage });


// Admin Dashboard Page
app.get("/admin", isAdmin, async (req, res) => {
    const menu = await Menu.find();
    res.render("admin", { menu });
});

// Handle Menu Upload
app.post("/admin/upload", isAdmin, upload.single("image"), async (req, res) => {
    const { name,desc, price } = req.body;
    const image = req.file ? "/uploads/" + req.file.filename : "";

    const newItem = new Menu({ name, desc, price, image });
    await newItem.save();

    res.redirect("/admin");
});

// Delete Menu Item
app.post("/admin/delete/:id", isAdmin, async (req, res) => {
    await Menu.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
});

// Profile Page
app.get('/profile', isAuthenticated, (req, res) => {
    res.render("profile", { user: req.session.user });
});

// Menu Page
app.get('/menu', isAuthenticated, async (req, res) => {
    const menu = await Menu.find();
    res.render("menu", {menu});
});

// Add to Cart Route (User-Specific)
app.post('/add-to-cart', isAuthenticated, async (req, res) => {
    const { name, desc, price, image } = req.body;
    const userId = req.session.user._id;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
        cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const itemIndex = cart.items.findIndex(item => item.name === name);
    if (itemIndex > -1) {
        cart.items[itemIndex].quantity += 1;
    } else {
        cart.items.push({ name, desc, price, image, quantity: 1 });
    }

    await cart.save();
    res.redirect('/menu');
});


// Remove Items from cart
app.post('/remove-from-cart', isAuthenticated, async (req, res) => {
    const { name } = req.body;
    const userId = req.session.user._id;

    await Cart.findOneAndUpdate(
        { userId },
        { $pull: { items: { name } } }
    );

    res.redirect('/cart');
});


app.post('/order-now', isAuthenticated, async (req, res) => {
    const { name, desc, price, address } = req.body;

    if (!name || !desc || !price || !address) {
        return res.send("Error: Item details or address missing.");
    }

    const userId = req.session.user._id;
    
    const newOrder = new Order({
        userId,
        items: [{ name, desc, price, quantity: 1 }],
        totalPrice: parseFloat(price),
        address,
        status: "Placed"
    });

    await newOrder.save();

    // Generate a receipt PDF
    const receiptPath = `receipts/order_${newOrder._id}.pdf`;
    generateReceiptPDF(newOrder, receiptPath);

    res.render("order-success", { orderId: newOrder._id, receiptPath });
});


// Checkout Route (User-Specific)
app.post('/checkout', isAuthenticated, async (req, res) => {
    const userId = req.session.user._id;
    let cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
        return res.redirect('/menu');
    }

    const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder = new Order({
        userId,
        items: cart.items,
        totalPrice: total
    });

    await newOrder.save();
    await Cart.deleteOne({ userId }); // Clear only this user's cart

    res.redirect('/orders');
});

// View Orders
app.get('/orders', isAuthenticated, async (req, res) => {
    const userId = req.session.user._id;
    const orders = await Order.find({ userId });
    res.render('orders', { orders });
});

// View Cart
app.get('/cart', isAuthenticated, async (req, res) => {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }) || { items: [] };
    res.render('cart', { cart });
});

function generateReceiptPDF(order, filePath) {
    const receiptsDir = path.join(__dirname, 'receipts');

    // Check if "receipts" directory exists, create if not
    if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir);
    }

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    doc.fontSize(20).text("Order Receipt", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Order ID: ${order._id}`);
    doc.text(`Delivery Address: ${order.address}`);
    doc.text(`Total Price: ₹${order.totalPrice}`);
    doc.moveDown();

    doc.text("Items Ordered:");
    order.items.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name} - ₹${item.price} (x${item.quantity})`);
    });

    doc.moveDown();
    doc.text("Thank you for ordering with us!", { align: "center" });

    doc.end();
}

app.get('/download-receipt/:orderId', isAuthenticated, (req, res) => {
    const filePath = `receipts/order_${req.params.orderId}.pdf`;
    res.download(filePath);
});


// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy(() => { // Destroy session (log out the user)
        res.redirect("/");
    });
});

// Start the Server
app.listen(3000, () => {
    console.log('App is running on port 3000');
});
