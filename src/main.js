import { Demo } from './Demo.js';

const SEEK_STEP = 5;

async function init() {
    const container = document.getElementById('container');
    const overlay = document.getElementById('overlay');
    const startButton = overlay.querySelector('.launch-start');
    const debug = new URLSearchParams(location.search).has('debug');

    if (debug) document.getElementById('info').style.display = 'block';

    try {
        const demo = new Demo(container);
        await demo.init();
        startButton.textContent = 'start';
        startButton.disabled = false;
        overlay.classList.remove('loading');

        const audio = demo.audio.element;
        let wakeLock = null;
        const shouldStayAwake = () =>
            demo.isActive && !audio.paused && document.visibilityState === 'visible';

        const requestWakeLock = async () => {
            if (!navigator.wakeLock || wakeLock || !shouldStayAwake()) return;

            try {
                const lock = await navigator.wakeLock.request('screen');
                if (wakeLock || !shouldStayAwake()) {
                    await lock.release();
                    return;
                }

                wakeLock = lock;
                lock.addEventListener('release', () => {
                    if (wakeLock === lock) wakeLock = null;
                }, { once: true });
            } catch {}
        };
        const releaseWakeLock = () => {
            const lock = wakeLock;
            wakeLock = null;
            lock?.release().catch(() => {});
        };
        const showStart = () => {
            releaseWakeLock();
            overlay.classList.remove('hidden');
        };
        const startDemo = () => {
            overlay.classList.add('hidden');
            demo.start().catch(error => {
                console.error('Failed to start demo:', error);
                showStart();
            });
        };

        demo.onEnded = showStart;
        audio.addEventListener('play', requestWakeLock);
        audio.addEventListener('pause', releaseWakeLock);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') requestWakeLock();
            else releaseWakeLock();
        });
        overlay.addEventListener('click', event => {
            if (!event.target.closest('a')) startDemo();
        });

        document.addEventListener('keydown', (event) => {
            if (event.repeat || !overlay.classList.contains('hidden')) return;

            if (event.key === 'Escape') {
                demo.stop();
                showStart();
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                demo.togglePause().catch(error => {
                    console.error('Failed to resume demo:', error);
                });
                return;
            }

            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                demo.seekBy(event.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP);
                return;
            }

            if (event.code === 'KeyF' && document.fullscreenEnabled) {
                const action = document.fullscreenElement
                    ? document.exitFullscreen()
                    : document.documentElement.requestFullscreen();
                Promise.resolve(action).catch(() => {});
            }
        }, true);

    } catch (error) {
        console.error('Failed to initialize demo:', error);
        overlay.classList.remove('loading');
        overlay.textContent = `Failed to load demo: ${error.message}`;
    }
}

init();
