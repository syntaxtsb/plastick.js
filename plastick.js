/*globals window, document*/

(function () {

    'use strict';

    // performance.now() shim -------------------------------------------------

    (function () {

        window.performance = window.performance || {};

        if (!window.performance.now) {

            var nowOffset = Date.now();
            window.performance.now = function now() {
                return Date.now() - nowOffset;
            };
        }
    }());

    // Plastick ----------------------------------------------------------------

    /**
     * Creates a new Plastick object
     *
     *     var game = new Plastick(stage);
     *
     * @property {Object} stage Reference to the Facade object linked to this Plastick.
     * @property {Object} states A stack of game states for flipping through various states of the game (intro, demo screen, menus, pause screen, etc).
     * @property {Integer} gameTick Current unit of game time.
     * @property {Boolean} isRunning True if the Plastick object is in a running state.
     * @param {Object} stage The Facade object that will handle drawing this Plastick object.
     * @return {Object} New Plastick object.
     * @api public
     */

    function Plastick(stage) {

        this.GAME_TICK_SPEED = 10; // ms per tick
        this.GAME_TICK_CHOKE = 50; // max # of ticks per canvas frame

        this.stage = stage;
        this.states = [];
        this.startTime = null;
        this.freezeStart = null;
        this.gameTick = 0;
        this.tickTime = 0;
        this.lastTickTime = 0;
        this.frameTime = 0;
        this.freezeTime = 0;
        this.isRunning = false;
        this.freezeOnBlur = true;

        window.addEventListener('blur', this.freeze.bind(this));
    }

    Plastick.prototype.currentState = function () {

        return this.states[this.states.length - 1];
    };

    Plastick.prototype.validateState = function (state) {

        if (!state.validated) {
            // make sure state has all the necessary methods
            if (typeof state.init !== 'function') {
                state.init = function () { return undefined; };
            }
            if (typeof state.cleanup !== 'function') {
                state.cleanup = function () { return undefined; };
            }
            if (typeof state.update !== 'function') {
                state.update = function () { return undefined; };
            }
            if (typeof state.draw !== 'function') {
                state.draw = function () { return undefined; };
            }
            if (typeof state.pause !== 'function') {
                state.pause = function () { return undefined; };
            }
            if (typeof state.resume !== 'function') {
                state.resume = function () { return undefined; };
            }
            if (typeof state.keyPressDown !== 'function') {
                state.keyPressDown = function () { return undefined; };
            }
            if (typeof state.keyPressUp !== 'function') {
                state.keyPressUp = function () { return undefined; };
            }
            state.validated = true;
        }
    };

    Plastick.prototype.pushState = function (state) {

        var s = this.currentState();
        if (s) {
            s.pause();
        }
        this.validateState(state);
        this.states.push(state);
        state.init();
    };

    Plastick.prototype.popState = function () {

        var s = this.states.pop();
        if (s) {
            s.cleanup();
        }
        s = this.currentState();
        if (s) {
            s.resume();
        }
    };

    Plastick.prototype.changeState = function (state) {

        var s = this.states.pop();
        if (s) {
            s.cleanup();
        }
        this.validateState(state);
        this.states.push(state);
        state.init();
    };

    Plastick.prototype.start = function (state) {

        this.pushState(state);
        this.isRunning = true;
        this.startTime = window.performance.now();
        this.tickTime = 0;
        this.frameTime = 0;
        this.stage.draw(this.gameLoop.bind(this));
    };

    Plastick.prototype.gameLoop = function () {

        this.frameTime = this.gameTime();
        this.update();
        this.currentState().draw();
    };

    Plastick.prototype.stop = function () {

        this.isRunning = false;
        this.stage.stop();
    };

    Plastick.prototype.cleanup = function () {

        while (this.states.length) {
            this.popState();
        }
    };

    Plastick.prototype.freeze = function () {

        // freeze game when window blurs
        if (this.freezeOnBlur) {
            this.freezeStart = window.performance.now();
        }
    };

    Plastick.prototype.gameTime = function () {

        if (this.freezeStart !== null) {
            this.freezeTime += window.performance.now() - this.freezeStart;
            this.freezeStart = null;
        }
        return window.performance.now() - this.startTime - this.freezeTime;
    };

    /**
     * The logic portion of the main game loop. This is called once per canvas
     * frame, but could simulate several game ticks in each call. The rate of the
     * game tick simulation is decoupled from the canvas frame rate (which is
     * governed by requestAnimationFrame(), via Facade). This allows the game to
     * have accurate timing. If the simulation falls behind momentarily, it will
     * try to catch up at a maximum rate of this.GAME_TICK_CHOKE.
     *
     */

    Plastick.prototype.update = function () {

        var ticksUpdated = 0;

        while ((this.gameTick * this.GAME_TICK_SPEED < this.frameTime) && (ticksUpdated < this.GAME_TICK_CHOKE)) {

            this.gameTick += 1;
            ticksUpdated += 1;

            this.currentState().update();

            this.lastTickTime = this.tickTime;
            this.tickTime = this.gameTime();
        }
    };

    window.Plastick = Plastick;

}());
