
import './libraries/howler.js'


const log = console.log;


function Sounds(obj = {}) {

    let loadedHowls = {};
    let queued = {};
    let userHasInteracted = false;
    let isEnabled = true;

    ["keydown", "click", "touch", "tap"].forEach(event => {
        window.addEventListener(event, () => {
            if (userHasInteracted) return true;
            userHasInteracted = true;
            processQueue();
        });
    });

    this.addSound = (name, src, settings = {}) => {
        if (userHasInteracted) return processQueue();
        queued[name] = { src, settings };
    };

    this.isMuted = () => false;

    this.stopAll = () => Howler.stop();

    this.play = (sound) => {
        if (this.isMuted()) return false;
        const thisSound = loadedHowls[sound];
        if (thisSound) thisSound.play();
    };

    for (const key in obj) this.addSound(key, obj[key]);

    function processQueue() {
        for (const name in queued) {
            const sound = queued[name];
            const src = sound.src;
            const settings = sound.settings;
            settings.src = [src];
            if (loadedHowls[name]) continue; // sound is already loaded
            loadedHowls[name] = new Howl(settings);
            if (settings.stopOtherSounds) loadedHowls[name].stopOtherSounds = true;
            delete queued[name]; // probably not necessary, but...
        }
    }
}


export { Sounds };
