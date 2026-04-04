window.goTo = function(screen) {
    console.log('goTo chamado:', screen);

    if (typeof window.switchScreen === 'function') {
        window.switchScreen(screen);
        return;
    }

    // fallback simples (caso não tenha switchScreen)
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.remove('active');
    });

    const target = document.getElementById(screen);
    if (target) target.classList.add('active');
};

window.openDemo = function() {
    console.log('Demo aberto 🚀');
    alert('Aqui vai abrir o demo depois');
};
