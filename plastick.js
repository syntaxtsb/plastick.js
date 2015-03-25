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

    // page focus polyfill -----------------------------------------------------

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

    // Plastick v0.4 ///////////////////////////////////////////////////////////

    /**
     * Create a Plastick object for your game by passing it a Facade object that will be used to draw to the canvas. The Plastick object automatically controls the update loop and draw loop for your game project, and transfers the game simulation between various States.
     *
     *     var game = new Plastick(stage);
     *
     * @property {Object} stage Reference to the Facade object linked to this Plastick.
     * @property {Object} states A stack of game states for flipping through various states of the game (intro, demo screen, menus, pause screen, etc).
     * @property {Float} startTime The time the game started running.
     * @property {Integer} currentTick Current unit of game time. Each tick represents one execution of the game state's update() method.
     * @property {Float} tickAlpha Interpolation (alpha) value of current tick. This is used in a system implementing fixed time step interpolation, to smooth screen updates that occur in between ticks. Updated immediately before executing the <code>Plastick.State.draw()</code> code.
     * @property {Boolean} isRunning True if the Plastick object is in a running state.
     * @property {Object} data A generic object which the user can store any game-related data in. This is not explicitly used by the Plastick framework, so you can store anything here.
     * @property {Integer} GAME_TARGET_TPS The target rate of game simulation, in ticks per second. Do not modify this while the game is running.
     * @property {Integer} GAME_TICK_CHOKE The maximum number of ticks simulated per canvas frame.
     * @param {Object} stage The Facade object that will handle drawing this Plastick object.
     * @return {Object} New Plastick object.
     * @api public
     */

    function Plastick(stage) {

        this.GAME_TARGET_TPS = 30; // target game ticks per second
        this.GAME_TICK_CHOKE = 50; // max # of ticks per canvas frame

        this.stage = stage;
        this.data = {};
        this.states = [];
        this.startTime = null;
        this.currentTick = 0;
        this.tickTime = 0;
        this.tickAlpha = 0;
        this.freezeOnBlur = true;

        this._isRunning = false;
        this._freezeStart = null;
        this._frameTime = 0;
        this._freezeLength = 0;

        document.addEventListener(visibilityChange, this._freeze.bind(this));

    }

    /**
     * This will initialize the game with a pre-defined game state and start simulating the game.
     *
     *     game.start(introState);
     *
     * @param {Object} state The Plastick.State object to start simulating with.
     * @return {Boolean} This returns <code>false</code> if no valid State is passed in or if the game was already running, otherwise it returns <code>true</code>.
     * @api public
     */

    Plastick.prototype.start = function (state) {

        var wasRunning = this.isRunning();

        if (state instanceof Plastick.State && !wasRunning) {

            this.pushState(state);
            this._isRunning = true;
            this.startTime = window.performance.now();
            this.tickTime = 0;
            this._frameTime = 0;
            this.stage.draw(this._gameLoop.bind(this));
            return true;
        }
        return state instanceof Plastick.State && !this.wasRunning;
    };

    /**
     * This will immediately halt simulation of the game and clear the
     * entire state stack.
     *
     *     game.stop();
     *
     * @return {Boolean} This returns <code>false</code> if the game was not already running, otherwise it returns <code>true</code>.
     */

    Plastick.prototype.stop = function () {

        var wasRunning = this.isRunning();

        if (wasRunning) {
            this._isRunning = false;
            this.stage.stop();
            this._cleanup();
        }
        return wasRunning;
    };

    /**
     * Used to check if the game is running.
     *
     *     if (game.isRunning()) { console.log('The game is running!'); }
     *
     * @return {Boolean} This returns <code>true</code> if <code>Plastick.start()</code> has been called and <code>Plastick.stop()</code> has not yet been called.
     * @api public
     */

    Plastick.prototype.isRunning = function () {

        return this._isRunning;
    };

    /**
     * This will pause the current game state and start simulation of a new game state by doing the following: <ul><li>Pause simulation of the current state by calling its pause() method and destroying its event listeners</li><li>Push the passed State onto the state stack, making it the current state</li><li>Call the new state's init() method and create its event listeners</li></ul>
     *
     *     game.pushState(pauseState);
     *
     * @param {Object} state The <code>Plastick.State</code> object to switch simulation to.
     * @return {Boolean} This returns <code>false</code> if no valid <code>Plastick.State</code> is passed in, otherwise it returns <code>true</code>.
     */

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

    /**
     * This will end the current game state and resume simulation of the previous game state by doing the following:<ul><li>End simulation of the current state by calling its <code>cleanup()</code> method and destroying its event listeners</li><li>Pop the current state off the state stack, making the prior state the current state</li><li>Call the prior state's <code>resume()</code> method and create its event listeners</li></ul>If calling this method empties the state stack, <code>Plastick.stop()</code> will be invoked.
     *
     *     game.popState();
     *
     * @return {Object} This returns <code>false</code> if there is no <code>Plastick.State</code> to pop off the state stack, otherwise this returns <code>true</code>.
     * @api public
     */

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

    /**
     * This will redirect simulation from the current game state to a new game state by doing the following:<ul><li>End simulation of the current state by calling its cleanup() method and destroying its event listeners</li><li>Pop the current state off the state stack and push the passed State onto the state stack, making it the current state</li><li>Call the new state's init() method and create its event listeners</li></ul>If calling this method empties the state stack, Plastick.stop() will be invoked. This may happen if the passed state is invalid and cannot be pushed onto the state stack.
     *
     *     game.changeState(menuState);
     *
     * @param {Object} state The <code>Plastick.State</code> object to switch simulation to.
     * @return {Object} This returns <code>false</code> if there is no <code>Plastick.State</code> to pop off the state stack or if no valid <code>Plastick.State</code> is passed in, otherwise this returns <code>true</code>.
     * @api public
     */

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

    /**
     * This returns the State currently being simulated.
     *
     *     game.currentState();
     *
     * @return {Object} Current game state, as a <code>Plastick.State</code> object.
     * @api public
     */

    Plastick.prototype.currentState = function () {

        return this.states[this.states.length - 1];
    };

    /**
     * Performs cleanup maintenance on a game that has been halted with <code>Plastick.stop()</code>.
     *
     *     game._cleanup();
     * @return {true}
     * @api private
     */

    Plastick.prototype._cleanup = function () {

        while (this.states.length) {
            this.popState();
        }
        return true;
    };

    /**
     * This returns the number of milliseconds that has passed in the game. Note that game time may be suspended whenever the containing browser tab is hidden.
     *
     *     game.gameTime();
     *
     * @return {Float} The number of milliseconds that have passed since <code>Plastick.start()</code> was called, not including "frozen" time (blurred focus).
     */

    Plastick.prototype.gameTime = function () {

        return window.performance.now() - this.startTime - this._freezeLength;
    };

    /**
     * Performs a linear interpolation between two numeric values using Plastick.tickAlpha.
     *
     *     var x = game.lerp(sprite.prevPosition.x, sprite.currPosition.x);
     *
     * @param {Float} before The "before" value.
     * @param {Float} after The "after" value.
     * @param {Float?} alpha If provided, the values will be interpolated using this alpha instead of Plastick.tickAlpha.
     * @return {Float} The result of the linear interpolation.
     */

    Plastick.prototype.lerp = function (before, after, alpha) {

        if (alpha !== undefined) {
            return (after - before) * alpha + before;
        }
        return (after - before) * this.tickAlpha + before;
    };

    /**
     * Freezes or unfreezes the game simulation (depending on the "blur" state of the web page when it's called). The example code shows how Plastick uses this method.
     *
     *     document.addEventListener(visibilityChange, this._freeze.bind(this));
     *
     * @return {void}
     * @api private
     */

    Plastick.prototype._freeze = function () {

        // freeze game when window blurs
        if (this.freezeOnBlur && document[hidden] && this.isRunning()) {
            this._freezeStart = window.performance.now();
            this._destroyEventListeners(this.currentState());
        }
        if (this.freezeOnBlur && !document[hidden] && this.isRunning()) {
            this._freezeLength += window.performance.now() - this._freezeStart;
            this._freezeStart = null;
            this._createEventListeners(this.currentState());
        }
    };

    /**
     * Creates event listeners registered to a game state.
     *
     *     this._createEventListeners(state);
     *
     * @param {Object} state The <code>Plastick.State</code> that is now current.
     * @return {void}
     * @api private
     */

    Plastick.prototype._createEventListeners = function (state) {

        state.listeners.forEach(function (listener) {
            listener.element.addEventListener(listener.eventType, listener.callback);
        });
    };

    /**
     * Removes event listeners registered to a game state.
     *
     *     this._destroyEventListeners(prevState);
     *
     * @param {Object} state The <code>Plastick.State</code> that was popped.
     * @return {void}
     * @api private
     */

    Plastick.prototype._destroyEventListeners = function (state) {

        state.listeners.forEach(function (listener) {
            listener.element.removeEventListener(listener.eventType, listener.callback);
        });
    };

    /**
     * The main game loop. The game is simulated using a fixed time step archtecture. _update() is called once per canvas frame, but could simulate several game ticks in each call. The rate of the game tick simulation is decoupled from the canvas frame rate (which is governed by requestAnimationFrame(), via Facade). If the simulation falls behind momentarily, it will try to catch up at a maximum rate of this.GAME_TICK_CHOKE ticks per call.
     *
     * @return {void}
     * @api private
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
        this.tickAlpha = this.gameTime() * this.GAME_TARGET_TPS / 1000 - this.currentTick + 1;
        this.currentState()._draw(this);
    };

    // Plastick.State //////////////////////////////////////////////////////////

    /**
     * This represents a game state (menu, pause screen, demo screen, etc). The default behavior for each method is to do nothing. The user can redefine each one by passing it a callback method.
     *
     *     menuState = new State();
     *
     * @return {Object} A new <code>Plastick.State</code> object.
     * @api public
     */

    Plastick.State = function () {

        this._init = function () { return undefined; };
        this._cleanup = function () { return undefined; };
        this._update = function () { return undefined; };
        this._draw = function () { return undefined; };
        this._pause = function () { return undefined; };
        this._resume = function () { return undefined; };
        this.listeners = [];
    };

    /**
     * This method allows the user to register an event listener with this state. All registered events are added to the page when this is the current state, and removed from the page when this state is paused or finished.
     *
     *     menuState.registerListener(document, 'click', function() {...});
     *
     * @param {Object} element The object to register the listener for.
     * @param {String} type The event to register the listener for.
     * @param {Function} callback The callback function to register.
     * @return {void}
     */

    Plastick.State.prototype.registerListener = function (element, type, callback) {

        this.listeners.push({
            element: element,
            eventType: type,
            callback: callback
        });
    };

    /**
     * This method allows the user to deregister an event listener with this state. If you want to deregister a specific callback, you _must_ pass in a reference of the same copy that was registered eariler. If the callback parameter is omitted, all callbacks linked to the specified element-event combination are deregistered.
     *
     *     menuState.deregisterListener(document, 'click');
     *
     * @param {Object} element The object to deregister the listener(s) for.
     * @param {String} type The event to deregister the listener(s) for.
     * @param {Function?} callback The specific callback function to deregister.
     * @return {void}
     * @api public
     */

    Plastick.State.prototype.deregisterListener = function (element, type, callback) {

        var oldListeners;

        oldListeners = this.listeners.slice();
        oldListeners.forEach(function (listener, index) {
            if (listener.element === element && listener.eventType === type && (listener.callback === callback || callback === undefined)) {
                this.listeners.splice(index, 1);
            }
        });
    };

    /**
     * Registers a callback to the <code>init()</code> method. This method is called by Plastick whenever this state is added to the state stack.
     *
     *     menuState.init(function() {...});
     *
     * @param {Function} func The function to use for the <code>init()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.init = function (func) {

        if (typeof func === 'function') { this._init = func; }
        return this._init;
    };

    /**
     * Registers a callback to the <code>cleanup()</code> method. This method is called by Plastick whenever this state is removed from the state stack.
     *
     *     menuState.cleanup(function() {...});
     *
     * @param {Function} func The function to use for the <code>cleanup()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.cleanup = function (func) {

        if (typeof func === 'function') { this._cleanup = func; }
        return this._cleanup;
    };

    /**
     * Registers a callback to the <code>update()</code> method. This method is called by Plastick once during each game tick. The passed callback should contain your main game loop, and as part of a fixed time step design it should always simulate a constant amount of game time. In order to maintain accurate timing in your game, Plastick may call this multiple times between each canvas frame.
     *
     *     menuState.update(function() {...});
     *
     * @param {Function} func The function to use for the <code>update()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.update = function (func) {

        if (typeof func === 'function') { this._update = func; }
        return this._update;
    };

    /**
     * Registers a callback to the <code>draw()</code> method. This method is called by Plastick once before each canvas frame is drawn. The passed callback should contain your rendering code. You do not need to call renderAnimationFrame(); this is done automatically by Plastick's Facade object.
     *
     *     menuState.draw(function() {...});
     *
     * @param {Function} func The function to use for the <code>draw()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.draw = function (func) {

        if (typeof func === 'function') { this._draw = func; }
        return this._draw;
    };

    /**
     * Registers a callback to the <code>pause()</code> method. This method is called by Plastick when this state is the current state and is being suspended to begin simulation of a new state.
     *
     *     menuState.pause(function() {...});
     *
     * @param {Function} func The function to use for the <code>pause()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.pause = function (func) {

        if (typeof func === 'function') { this._pause = func; }
        return this._pause;
    };

    /**
     * Registers a callback to the <code>resume()</code> method. This method is called by Plastick when this state is suspended and is resuming simulation as the current state.
     *
     *     menuState.resume(function() {...});
     *
     * @param {Function} func The function to use for the <code>resume()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

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
