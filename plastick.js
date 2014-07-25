(function () {

    'use strict';

    // performance.now() shim --------------------------------------------------

    (function () {

        window.performance = window.performance || {};
        if (!window.performance.now) {
            var nowOffset = Date.now();
            window.performance.now = function now() {
                return Date.now() - nowOffset;
            };
        }
    }());

    // page focus shims --------------------------------------------------------

    var hidden, visibilityChange;
    if (document.hidden !== 'undefined') { // Opera 12.10 and Firefox 18 and later support
        hidden = 'hidden';
        visibilityChange = 'visibilitychange';
    } else if (document.mozHidden !== 'undefined') {
        hidden = 'mozHidden';
        visibilityChange = 'mozvisibilitychange';
    } else if (document.msHidden !== 'undefined') {
        hidden = 'msHidden';
        visibilityChange = 'msvisibilitychange';
    } else if (document.webkitHidden !== 'undefined') {
        hidden = 'webkitHidden';
        visibilityChange = 'webkitvisibilitychange';
    }

    // Plastick ////////////////////////////////////////////////////////////////

    /**
     * Creates a new Plastick object
     *
     *     var game = new Plastick(stage);
     *
     * @property {Object} stage Reference to the Facade object linked to this Plastick.
     * @property {Object} states A stack of game states for flipping through various states of the game (intro, demo screen, menus, pause screen, etc).
     * @property {Integer} currentTick Current unit of game time.
     * @property {Boolean} isRunning True if the Plastick object is in a running state.
     * @param {Object} stage The Facade object that will handle drawing this Plastick object.
     * @return {Object} New Plastick object.
     * @api public
     */

    function Plastick(stage) {

        this.GAME_TARGET_TPS = 60; // target game ticks per second
        this.GAME_TICK_CHOKE = 50; // max # of ticks per canvas frame

        this.stage = stage;
        this.data = {};
        this.states = [];
        this.startTime = null;
        this.currentTick = 0;
        this.tickTime = 0;
        this.isRunning = false;
        this.freezeOnBlur = true;

        this._freezeStart = null;
        this._frameTime = 0;
        this._freezeLength = 0;

        document.addEventListener(visibilityChange, this._freeze.bind(this));

    }

    Plastick.prototype.currentState = function () {

        return this.states[this.states.length - 1];
    };

    Plastick.prototype.pushState = function (state) {

        var prevState = this.currentState();

        if (prevState) {
            prevState._pause(this);
            this._destroyEventListeners(prevState);
        }
        if (state instanceof Plastick.State) {
            this.states.push(state);
            state._init(this);
            this._createEventListeners(state);
        }
        return state instanceof Plastick.State;
    };

    Plastick.prototype.popState = function () {

        var prevState = this.states.pop(),
            state;

        if (prevState) {
            prevState._cleanup(this);
            this._destroyEventListeners(prevState);
        }
        state = this.currentState();
        if (state) {
            state._resume(this);
            this._createEventListeners(state);
        } else {
            this.stop();
        }
        return prevState !== undefined;
    };

    Plastick.prototype.changeState = function (state) {

        var prevState = this.states.pop();

        if (prevState) {
            prevState._cleanup(this);
            this._destroyEventListeners(prevState);
        }
        if (state instanceof Plastick.State) {
            this.states.push(state);
            state._init(this);
            this._createEventListeners(state);
        }
        return prevState !== undefined && state instanceof Plastick.State;
    };

    Plastick.prototype.start = function (state) {

        var wasRunning = this.isRunning;

        if (state instanceof Plastick.State && !wasRunning) {

            this.pushState(state);
            this.isRunning = true;
            this.startTime = window.performance.now();
            this.tickTime = 0;
            this._frameTime = 0;
            this.stage.draw(this._gameLoop.bind(this));
            return true;
        }
        return state instanceof Plastick.State && !this.wasRunning;
    };

    Plastick.prototype.stop = function () {

        var wasRunning = this.isRunning;

        if (wasRunning) {
            this.isRunning = false;
            this.stage.stop();
            this.cleanup();
        }
        return wasRunning;
    };

    Plastick.prototype.cleanup = function () {

        while (this.states.length) {
            this.popState();
        }
        return true;
    };

    Plastick.prototype.gameTime = function () {

        return window.performance.now() - this.startTime - this._freezeLength;
    };

    Plastick.prototype._freeze = function () {

        // freeze game when window blurs
        if (this.freezeOnBlur && document[hidden]) {
            this._freezeStart = window.performance.now();
            this._destroyEventListeners(this.currentState());
        }
        if (this.freezeOnBlur && !document[hidden]) {
            this._freezeLength += window.performance.now() - this._freezeStart;
            this._freezeStart = null;
            this._createEventListeners(this.currentState());
        }
    };

    Plastick.prototype._createEventListeners = function (state) {

        state.listeners.forEach(function (listener) {
            listener.element.addEventListener(listener.eventType, listener.callback);
        });
    };

    Plastick.prototype._destroyEventListeners = function (state) {

        state.listeners.forEach(function (listener) {
            listener.element.removeEventListener(listener.eventType, listener.callback);
        });
    };

    /**
     * The main game loop. The game is simulated using a
     * fixed timestep archtecture. _update() is called once per canvas frame,
     * but could simulate several game ticks in each call. The rate of the
     * game tick simulation is decoupled from the canvas frame rate (which is
     * governed by requestAnimationFrame(), via Facade). If the simulation
     * falls behind momentarily, it will try to catch up at a maximum rate of
     * this.GAME_TICK_CHOKE ticks per call.
     *
     */

    Plastick.prototype._gameLoop = function () {

        var ticksUpdated = 0;

        this._frameTime = this.gameTime();
        while (this._frameTime * this.GAME_TARGET_TPS / 1000 > this.currentTick &&
                ticksUpdated < this.GAME_TICK_CHOKE) {

            this.currentTick += 1;
            ticksUpdated += 1;
            this.currentState()._update(this);
            this.tickTime = this.gameTime();
        }
        this.currentState()._draw(this);
    };

    // Plastick.State //////////////////////////////////////////////////////////

    Plastick.State = function () {

        this._init = function () { return undefined; };
        this._cleanup = function () { return undefined; };
        this._update = function () { return undefined; };
        this._draw = function () { return undefined; };
        this._pause = function () { return undefined; };
        this._resume = function () { return undefined; };
        this.listeners = [];
    };

    Plastick.State.prototype.registerListener = function (element, type, callback) {

        this.listeners.push({
            element: element,
            eventType: type,
            callback: callback
        });
    };

    Plastick.State.prototype.deregisterListener = function (element, type, callback) {

        var oldListeners;

        oldListeners = this.listeners.slice();
        oldListeners.forEach(function (listener, index) {
            if (listener.element === element && listener.eventType === type && (listener.callback === callback || callback === undefined)) {
                this.listeners.splice(index, 1);
            }
        });
    };

    Plastick.State.prototype.init = function (func) {

        if (typeof func === 'function') { this._init = func; }
        return this._init;
    };

    Plastick.State.prototype.cleanup = function (func) {

        if (typeof func === 'function') { this._cleanup = func; }
        return this._cleanup;
    };

    Plastick.State.prototype.update = function (func) {

        if (typeof func === 'function') { this._update = func; }
        return this._update;
    };

    Plastick.State.prototype.draw = function (func) {

        if (typeof func === 'function') { this._draw = func; }
        return this._draw;
    };

    Plastick.State.prototype.pause = function (func) {

        if (typeof func === 'function') { this._pause = func; }
        return this._pause;
    };

    Plastick.State.prototype.resume = function (func) {

        if (typeof func === 'function') { this._resume = func; }
        return this._resume;
    };

    /*
     * AMD Support
     */

    if (typeof define === 'function' && define.amd !== undefined) {
        define([], function () { return Plastick; });
    } else if (typeof module === 'object' && module.exports !== undefined) {
        module.exports = Plastick;
    } else {
        window.Plastick = Plastick;
    }


}());
