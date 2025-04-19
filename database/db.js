const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://akashduttabusiness96:54CkZkNvgwZZIWjL@cluster0.sihdt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connection = mongoose.connect(MONGO_URI).then(()=>{
    console.log("Database Connected");
}).catch((err)=>{
    console.log("Connection Failed", err);
});

module.exports = connection;