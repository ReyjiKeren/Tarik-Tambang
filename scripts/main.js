document.addEventListener('DOMContentLoaded', () => {
    const btnPlay = document.getElementById('btn-play');
    const btnJoin = document.getElementById('btn-join');
    const btnHowto = document.getElementById('btn-howto');
    const joinModal = document.getElementById('join-modal');
    const btnConnect = document.getElementById('btn-connect');
    const inputCode = document.getElementById('join-code-input');
    const btnBack = document.getElementById('btn-back-menu');

    // SFX placeholder (would load from assets)
    const playSound = (type) => {
        // console.log(`Playing sound: ${type}`);
    };

    // --- Animation Handling ---
    const overlay = document.getElementById('page-overlay');

    // Fade IN on load
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.style.display = 'none', 500);
    }, 100);

    const navigateTo = (url) => {
        overlay.style.display = 'block';
        // Force reflow
        void overlay.offsetWidth;
        overlay.classList.remove('fade-out');

        setTimeout(() => {
            window.location.href = url;
        }, 500);
    };

    btnPlay.addEventListener('click', () => {
        playSound('click');
        navigateTo('game.html?mode=host');
    });

    btnJoin.addEventListener('click', () => {
        playSound('click');
        navigateTo('game.html?mode=join');
    });

    btnHowto.addEventListener('click', () => {
        navigateTo('tutorial.html');
    });
});
