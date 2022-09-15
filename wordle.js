import { choiceWords, otherWords } from "./wordlist.js";
import { Sounds } from "./Sounds.js";
import { ConfettiCelebration } from "./ConfettiCelebration.js";
import { shakeElement } from "./shakeElement.js";
import { fitInParent } from "./fitInParent.js";


const log = console.log;


const wordsList = choiceWords;
const allWords = [...choiceWords, ...otherWords];


const controller = new WordleController();
function WordleController() {

    let gameOver = false;

    const confettiCelebration = new ConfettiCelebration();
    confettiCelebration.onTouch = () => problem.new();
    const controlButton = new ControlButton("#control-button");
    const display = new Display();
    const keyboard = new Keyboard();
    const list = new List(wordsList, allWords);
    const muteButton = new MuteHandler("#mute-button");
    const sounds = new Sounds({
        tick: "../sounds/tick.mp3",
        tada: "../sounds/tada.mp3",
        defeat: "../sounds/defeat.mp3",
    });
    const problem = new Problem(Word, { sounds });
    const touchpad = new Touchpad();

    sounds.isMuted = () => muteButton.isMuted;

    problem.display = display;
    problem.list = list;
    problem.controlButton = controlButton;
    problem.shakeElement = shakeElement;
    problem.onInvalidInput = () => sounds.play("defeat");

    const giveUpHandler = () => {
        const reallyGiveUp = window.confirm("Really give up?");
        if (!reallyGiveUp) return controlButton.set("Give up?", giveUpHandler);
        gameOver = true;
        return controlButton.set(`The word is '${problem.word}'. Play again?`, problem.new); // 全角 space in there!
    };

    problem.giveUpHandler = giveUpHandler;

    const endSequence = didWin => {
        gameOver = true;
        const message = didWin ? "You win!" : `You lose! It's ${problem.word}. `;
        controlButton.set(message + " Play again?", problem.new);
        didWin ? victoryDance() : defeat();
    };

    const victoryDance = () => {
        display.bounceLetters();
        confettiCelebration.new();
        sounds.play("tada");
    };

    const defeat = () => {
        sounds.play("defeat");
        shakeElement(display.displayElement);
    };

    keyboard.onEnter = () => gameOver ? problem.new() : problem.submit();
    keyboard.onInput = (lettersArray, doAnimate) => {
        if (!gameOver && !muteButton.isMuted) sounds.play("tick");
        display.showLetters(lettersArray, doAnimate);
    };
    keyboard.isEnabled = () => !gameOver;

    display.build();
    display.getCurrentGuessLength = () => keyboard.getNumFilled();
    display.onShowAnswer = array => touchpad.colorKeys(array, problem.getUserGuess());

    problem.getUserGuess = () => keyboard.getUserGuess();
    problem.onSubmit = (resultsArray, isCorrect, isLastGuess) => {
        display.revealResult(resultsArray, () => {
            keyboard.clear();
            if (isCorrect) return endSequence(true);
            if (isLastGuess) return endSequence(false);
        });
    };
    problem.onNew = () => {
        gameOver = false;
        controlButton.set("Give up?", giveUpHandler);
        keyboard.clear();
        display.build();
        problem.currentGuess = 1;
        touchpad.clearAll();
        confettiCelebration.cleanUp();
    };

    touchpad.onclick = key => {
        flashClass(key, "jump");
        const letter = key.querySelector(".letter-holder").textContent.toUpperCase();
        keyboard.triggerKeydown(letter);
    };
    touchpad.onEnterKeyClick = () => problem.submit();
    touchpad.onDeleteKeyClick = () => keyboard.removeLast();

    document.querySelector("#question-icon").onclick = () => {
        const settings = document.querySelector("#settings-window");
        settings.classList.add("showing");
        settings.addEventListener("click", () => settings.classList.remove("showing"));
    };

    problem.new();
}


function ControlButton(id) {

    const button = document.querySelector(id);

    this.set = (text, func) => {
        button.innerHTML = text;
        button.onclick = func;
    };
}


function MuteHandler(id, settings = {}) {

    const button = document.querySelector(id);
    const key = settings.localStorageKey ?? "wordle_is_muted";

    this.isMuted = false;
    this.disabled = false;
    this.onChange = () => undefined;

    const setLocalStorage = val => {
        localStorage[key] = val ?? (localStorage[key] ?? (settings.defaultValue ?? false));
        this.isMuted = JSON.parse(localStorage[key]);
        setIcons(this.isMuted);
    };

    const toggleMuteState = val => {
        if (this.disabled) return;
        this.isMuted = val ?? !JSON.parse(this.isMuted);
        setLocalStorage(this.isMuted);
        this.onChange(!this.isMuted);
    };

    const setIcons = val => {
        button.classList.toggle("muted", val);
    }

    button.onclick = () => toggleMuteState();
    setLocalStorage();
}


function Problem(Word, obj = {}) {

    let secretWord, wordleWord;

    this.disabled = this.disabled ?? false;
    this.numLetters = obj.numLetters ?? 5;
    this.currentGuess = 1;
    this.numGuesses = obj.numGuesses ?? 6;
    this.display = undefined;
    this.list = undefined;
    this.controlButton = undefined;
    this.shakeElement = undefined;
    this.onInvalidInput = () => undefined;
    this.sounds = obj.sounds ?? {};

    this.new = () => {
        this.sounds.stopAll();
        secretWord = this.list.pick().toUpperCase();
        wordleWord = new Word(secretWord);
        this.word = secretWord;
        this.onNew();
        log(secretWord);
    };

    this.getUserGuess = () => undefined;
    this.onNew = () => undefined;
    this.onSubmit = () => undefined;

    this.submit = () => {
        const userGuess = this.getUserGuess();
        if (!userGuess) return true;
        if (this.list.isNotValidWord(userGuess)) return invalidGuess(userGuess);
        const result = wordleWord.check(userGuess);
        const isCorrect = isCorrectAnswer(result);
        this.currentGuess += 1;
        this.onSubmit(result, isCorrect, this.currentGuess > this.numGuesses);
    };

    const invalidGuess = (userGuess) => {
        this.controlButton.set(`Sorry, ${userGuess} is not on the words list.`);
        this.shakeElement(this.display.displayElement);
        this.onInvalidInput(userGuess);
        ["keydown", "mousemove"].forEach(event => window.addEventListener(event, dismissWarning));
    };

    const dismissWarning = () => {
        ["keydown", "mousemove"].forEach(event => window.removeEventListener(event, dismissWarning));
        this.controlButton.set("Give up?", this.giveUpHandler);
    };

    const isCorrectAnswer = array => array.every(n => n === 2);

    const invalidHandler = guess => log(`${guess} is not on the word list`);
}


function Word(w) {

    if (!w) return log("Gotta pass in a word, butthead!");

    this.contains = (letter, index) => {
        if (w.charAt(index) === letter) return 2;
        if (w.includes(letter)) return 1;
        return 0;
    };

    this.word = w;

    this.check = guess => guess.split("").map((letter, index) => this.contains(letter, index));
}


function List(choiceWords, allWords) {

    const pickRandom = array => array[Math.floor(Math.random() * array.length)];

    this.choices = choiceWords ?? [];
    this.doneWords = [];

    this.pick = () => {
        const randomWord = pickRandom(this.choices);
        if (!randomWord) return log("No words to choose from!");
        if (this.doneWords.includes(randomWord)) return this.pick();
        this.doneWords.push(randomWord);
        return randomWord;
    };

    this.isValidWord = w => allWords.includes(w.toLowerCase());

    this.isNotValidWord = w => !this.isValidWord(w);
}


function Keyboard(obj = {}) {

    const letters = [];

    const addLetter = letter => {
        if (letters.length >= this.maxLength) return false;
        letters.push(letter);
        this.onInput(letters, true); // true ==> do animate display
    };

    this.maxLength = obj.maxLength ?? 5;

    this.onClear = () => undefined;

    this.getUserGuess = () => letters.length === this.maxLength ? letters.join("").toUpperCase() : "";

    this.clear = () => {
        letters.length = 0;
        this.onInput(letters, false);
        this.onClear();
    };

    this.getNumFilled = () => letters.length;

    this.onInput = () => undefined;

    this.onEnter = () => undefined;

    this.isEnabled = () => true;

    this.removeLast = () => {
        if (letters.length) letters.pop();
        this.onInput(letters, false);
    };

    this.triggerKeydown = key => keydownHandler({ key });

    window.addEventListener("keydown", e => keydownHandler(e));

    const keydownHandler = e => {
        if (!e.key || e.repeat || e.ctrlKey || e.shiftKey || e.metaKey) return true;
        if (e.key === "Backspace") return this.removeLast();
        if (e.key === "Enter") return this.onEnter();
        if (!/^[a-z]{1}$/gi.test(e.key)) return true; // single letter A-Z (no Backspace, numbers or space)
        if (this.isEnabled()) addLetter(e.key.toUpperCase());
    };
}


function Display(obj = {}) {

    const display = document.querySelector(obj.id ?? "#display");
    const rowTemplate = document.querySelector(".row-holder").cloneNode(true)
    rowTemplate.classList.remove("my-template");
    const classes = ["miss", "near", "hit"];

    const addNewRow = () => display.appendChild(rowTemplate.cloneNode(true));
    const getActiveRow = () => document.querySelector(".row-holder:not(.submitted)");
    const getCells = () => getActiveRow()?.querySelectorAll(".letter-holder") ?? [];
    const getBouncers = () => getActiveRow()?.querySelectorAll(".bouncer") ?? [];
    const getLastCell = () => getCells()[this.getCurrentGuessLength() - 1];
    const getLastInputRow = () => [...document.querySelectorAll(".submitted")].reverse()[0];

    // obj.fitInParent(display, { drawBorder: true, transforms: "translate(-50%, -50%)", });

    this.displayElement = display;
    this.getCurrentGuessLength = () => undefined;
    this.onShowAnswer = () => undefined;
    this.onShowLetters = () => undefined;

    this.showLetters = (array, doAnimate) => {
        getCells().forEach(holder => holder.textContent = "");
        array.forEach((letter, index) => {
            const cell = getCells()[index];
            if (cell) cell.textContent = letter.toUpperCase();
        });
        if (doAnimate) flashClass(getLastCell()?.parentElement, "swell");
        this.onShowLetters();
    };

    this.revealResult = (resultsArray, onFinish) => {
        resultsArray.forEach((n, i) => {
            const bouncers = getBouncers();
            setTimeout(() => {
                bouncers[i].classList.add(classes[n], "showing-answer");
            }, i * 100);
        });
        getActiveRow()?.classList.add("submitted");
        this.onShowAnswer(resultsArray);
        onFinish && onFinish();
    };

    function adjustCellSize() {
        const nagasa = document.querySelector(".letter-frame").offsetHeight;
        document.querySelectorAll(".letter-frame").forEach(frame => frame.style.width = nagasa + "px");
    }
    ["click", "resize", "orientationchange"].forEach(event => window.addEventListener(event, adjustCellSize));

    this.build = () => {
        this.clear();
        const numRows = obj.numRows ?? 6;
        for (let i = 0; i < numRows; i++) addNewRow();
        const frame = display.parentElement;
        window.dispatchEvent(new Event("resize"));
    };

    this.clear = () => display.innerHTML = "";

    this.bounceLetters = () => {
        getLastInputRow()?.querySelectorAll(".letter-frame").forEach((cell, index) => {
            setTimeout(() => flashClass(cell, "jump"), index * 100);
        });
    };
}


function Touchpad() {

    const keyboard = document.querySelector("#keyboard");
    const key = keyboard.querySelector(".key");
    const keyMaster = key.cloneNode(true);
    const classes = ["miss", "near", "hit"];

    fitInParent(keyboard);

    const keysObject = {};
    key.remove();

    const fillLetter = (key, letter) => key.querySelector(".letter-holder").textContent = letter;

    const keyboardRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

    keyboardRows.forEach(letters => {
        const row = document.createElement("div");
        row.classList.add("keyboard-row");
        keyboard.appendChild(row);
        letters.split("").forEach(letter => {
            const key = keyMaster.cloneNode(true);
            fillLetter(key, letter);
            keysObject[letter] = key;
            key.onclick = () => this.onclick(key);
            row.appendChild(key);
        });
    });

    // adding Enter and Delete keys
    [{
        id: "enter-key",
        text: "Enter",
        onclick: () => this.onEnterKeyClick(),
    }, {
        id: "delete-key",
        text: "<i style='transform: scale(1.3);' class='bi bi-backspace'></i>",
        onclick: () => this.onDeleteKeyClick(),
    }].forEach((obj, i) => {
        const key = document.createElement("div");
        key.id = obj.id;
        key.classList.add("control-key");
        key.innerHTML = obj.text;
        key.onclick = obj.onclick;
        document.querySelector(".keyboard-row:last-child")[i === 0 ? "prepend" : "appendChild"](key);
    });

    const clearKey = key => classes.forEach(c => key.classList.remove(c));

    this.onclick = () => undefined;
    this.onEnterKeyClick = () => undefined;
    this.onDeleteKeyClick = () => undefined;

    this.mark = (letter, klass) => {
        clearKey(keysObject[letter]);
        keysObject[letter].classList.add(klass);
    };

    this.clearAll = () => {
        for (let key in keysObject) clearKey(keysObject[key]);
    };

    this.colorKeys = (array, word) => {
        word.split("").forEach((letter, index) => {
            const klass = classes[array[index]];
            keysObject[letter].classList.remove("miss", "near");
            keysObject[letter].classList.add(klass);
        });
    };
}


function MessageWindow(id) {
    const window = document.querySelector(id);
    this.clear = () => window.textContent = "";
    this.show = text => window.textContent = text;
}


function flashClass(elem, klass) {
    if (!elem || !klass) return false;
    elem.onanimationend = () => elem.classList?.remove(klass);
    elem.classList.add(klass);
}
