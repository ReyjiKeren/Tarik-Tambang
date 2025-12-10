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

    btnPlay.addEventListener('click', () => {
        playSound('click');
        // Host Mode
        window.location.href = 'game.html?mode=host';
    });

    btnJoin.addEventListener('click', () => {
        playSound('click');
        // Show Join Modal if we were doing the connection here, 
        // but our design says we do connection on game.html.
        // However, standard flow implies "Join" takes you to a place to enter code.
        // Let's redirect to game.html?mode=join and handle UI there.
        window.location.href = 'game.html?mode=join';
    });

    btnHowto.addEventListener('click', () => {
        window.location.href = 'tutorial.html';
    });
});
