import { Demo } from './Demo.js';

const SEEK_STEP = 5;

async function init() {
    const container = document.getElementById('container');
    const overlay = document.getElementById('overlay');
    const startLabel = overlay.querySelector('.launch-start');
    const debug = new URLSearchParams(location.search).has('debug');

    if (debug) document.getElementById('info').style.display = 'block';

    try {
        const demo = new Demo(container);
        await demo.init();
        startLabel.textContent = 'click to begin';
        overlay.classList.remove('loading');

        const showStart = () => {
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
            }
        }, true);

    } catch (error) {
        console.error('Failed to initialize demo:', error);
        overlay.classList.remove('loading');
        overlay.textContent = `Failed to load demo: ${error.message}`;
    }
}

init();
