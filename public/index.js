const menuList = document.getElementById('menuList');
const searchInput = document.getElementById('searchInput');
const productCards = document.querySelectorAll('.product-card');

menuList.style.maxHeight = '0px';

function toggleMenu() {
    if (menuList.style.maxHeight === '0px') {
        menuList.style.maxHeight = '300px';
    } else {
        menuList.style.maxHeight = '0px';
    }
}


searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();

    productCards.forEach(card => {
        const name = card.querySelector('.item-name').textContent.toLowerCase();
        const desc = card.querySelector('.item-desc').textContent.toLowerCase();

        if (name.includes(searchTerm) || desc.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

