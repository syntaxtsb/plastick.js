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

    // Plastick v0.4.1 /////////////////////////////////////////////////////////

    /**
     * Create a Plastick object for your game by passing it a canvas object OR a Facade object that will be used to draw to the canvas. The Plastick object automatically controls the update loop and draw loop for your game project, and transfers the game simulation between various States.
     *
     * ```
     * var game = new Plastick(stage);
     * ```
     *
     * @property {Object} canvas Reference to the canvas object.
     * @property {Object} facade Reference to the Facade context, if one is being used.
     * @property {Object} context Reference to the canvas rendering context.
     * @property {Object} states A stack of game states for flipping through various states of the game (intro, demo screen, menus, pause screen, etc).
     * @property {Float} startTime The session time at which <code>Plastick.start()</code> was called.
     * @property {Integer} currentTick Current unit of game time. Each tick represents one execution of the <code>Plastick.State.update()</code> method.
     * @property {Float} tickAlpha Interpolation (alpha) value of current tick. This is used in a system implementing fixed time step interpolation, usually to smooth screen updates that occur in between ticks. Updated immediately before executing the <code>Plastick.State.draw()</code> code.
     * @property {Boolean} isRunning True if the Plastick object is in a running state.
     * @property {Object} data A generic object which the user can store any game-related data in. This is not explicitly used by the Plastick framework, so you can store anything here.
     * @property {Object} methods A generic object which the user can store any game-related methods in. This is not explicitly used by the Plastick framework, so you can store anything here.
     * @property {Integer} TARGET_TPS The target rate of game simulation, in ticks per second. Modifying this while the game is running may result in inaccurate simulation.
     * @property {Integer} TICK_CHOKE The maximum number of ticks simulated per canvas frame.
     * @param {Object} stage The canvas object or Facade object that will handle drawing the Plastick states.
     * @return {Object} New Plastick object.
     * @api public
     */

    function Plastick(stage) {

        this.TARGET_TPS = 30; // target game ticks per second
        this.TICK_CHOKE = 50; // max # of ticks per canvas frame

        if (stage.getContext !== undefined) {
            this.canvasMode = 'native canvas';
            this.canvas = stage;
            this.context = stage.getContext('2d');
        } else {
            this.canvasMode = 'facade';
            this.facade = stage;
            this.canvas = stage.canvas;
            this.context = stage.context;
        }

        this.HDPIMode = 1;
        this.data = {};
        this.methods = {};
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

        this._debugMode = false;
        this._debugStopGameEvent = (function (e) {
            if (e.keyCode === 32 && e.shiftKey) {
                e.preventDefault();
                this.stop();
            }
        }).bind(this);

        document.addEventListener(visibilityChange, this._freeze.bind(this));
    }

    Plastick.prototype.setHDPIMode = function (scale) {

        // set HDPI scale
        if (typeof scale === 'boolean') {
            this.HDPIMode = scale ? 2 : 1;
        } else if (typeof scale === 'number') {
            this.HDPIMode = scale;
        } else {
            this.HDPIMode = 1;
        }

        if (this.canvasMode === 'native canvas') {

            this.canvas.setAttribute('style', 'width: ' + this.canvas.width + 'px; height: ' + this.canvas.height + 'px;');
            this.canvas.setAttribute('width', this.canvas.width * this.HDPIMode);
            this.canvas.setAttribute('height', this.canvas.height * this.HDPIMode);
            this.context.scale(this.HDPIMode, this.HDPIMode);
            this.canvas.setAttribute('data-resized-for-hdpi', true);
        } else {

            // set HDPI for Facade object
            this.facade.resizeForHDPI(this.HDPIMode);
        }
    };

    /**
     * This will initialize the game with a pre-defined game state and start simulating the game.
     *
     * ```
     * game.start(introState);
     * ```
     *
     * @param {Object} state The Plastick.State object to start simulating with.
     * @return {Boolean} This returns <code>false</code> if no valid State is passed in or if the game was already running, otherwise it returns <code>true</code>.
     * @api public
     */

    Plastick.prototype.start = function (state) {

        var wasRunning = this.isRunning();

        if (state instanceof Plastick.State && !wasRunning) {

            this._isRunning = true;
            this.startTime = window.performance.now();
            this.tickTime = 0;
            this._frameTime = 0;

            this.states.push(state);
            if (this._debugMode) {
                this.debug('Game started, using ' + this.canvasMode + ' (' + this.currentState().name + ')');
            }
            this._createEventListeners(state);
            state._init(this);

            if (this.canvasMode === 'native canvas') {
                window.requestAnimationFrame(this._requestAnimationFrame.bind(this));
            } else {
                this.facade.draw(this._gameLoop.bind(this));
            }

            return true;
        }
        return state instanceof Plastick.State && !this.wasRunning;
    };

    /**
     * This will end simulation of the game and pop all states off the state stack.
     *
     * Note that this does not terminate execution of the current game tick. You may want to follow this by <code>return</code>ing from the update loop, or alternately place this call at the very end of your update loop.
     *
     * ```
     * // pressed Escape to quit the game
     * if (pressedEsc) { game.stop(); }
     * ```
     *
     * @return {Boolean} This returns <code>false</code> if the game was not already running, otherwise it returns <code>true</code>.
     */

    Plastick.prototype.stop = function () {

        var wasRunning = this.isRunning();

        if (wasRunning) {
            this._isRunning = false;
            if (this.canvasMode === 'facade') this.facade.stop();
            this._cleanup();

            if (this._debugMode) {
                this.debug('Game stopped');
            }
        }
        return wasRunning;
    };

    /**
     * Used to check if the game is running.
     *
     * ```
     * if (game.isRunning()) { console.log('The game is running!'); }
     * ```
     *
     * @return {Boolean} This returns <code>true</code> if <code>Plastick.start()</code> has been called and <code>Plastick.stop()</code> has not yet been called.
     * @api public
     */

    Plastick.prototype.isRunning = function () {

        return this._isRunning;
    };

    /**
     * This will pause the current game state and start simulation of a new game state on the next game tick by doing the following: <ul><li>Calling the current state's <code>pause()</code> method and destroying its event listeners</li><li>Pushing the passed State onto the state stack, making it the current state</li><li>Calling the new state's <code>init()</code> method and creating its event listeners</li></ul>
     * Note that this does not terminate execution of the current game tick. Since simulation of the new state will not begin until the next game tick, you may want to follow this by <code>return</code>ing from the update loop, or alternately place this call at the very end of your update loop.
     *
     * ```
     * // pause the game
     * if (pauseButtonPressed) {
     *     game.pushState(pauseState);
     *     return;
     * }
     * ```
     *
     * @param {Object} state The <code>Plastick.State</code> object to switch simulation to.
     * @return {Boolean} This returns <code>false</code> if no valid <code>Plastick.State</code> is passed in, otherwise it returns <code>true</code>.
     */

    Plastick.prototype.pushState = function (state) {

        var prevState = this.currentState();

        if (prevState && state instanceof Plastick.State) {
            prevState._pause(this);
            this._destroyEventListeners(prevState);

            this.states.push(state);
            if (this._debugMode) {
                this.debug('Pushed state (' + prevState.name + ' -> ' + this.currentState().name + ')');
            }
            this._createEventListeners(state);
            state._init(this);

        }
        return state instanceof Plastick.State;
    };

    /**
     * This will end the current game state and resume simulation of the previous game state on the next game tick by doing the following:<ul><li>Calling the current state's <code>cleanup()</code> method and destroying its event listeners</li><li>Popping the current state off the state stack, making the prior state the current state</li><li>Calling the prior state's <code>resume()</code> method and creating its event listeners</li></ul>
     * Note that this does not terminate execution of the current game tick. Since simulation of the prior state will not resume until the next game tick, you may want to follow this by <code>return</code>ing from the update loop, or alternately place this call at the very end of your update loop.
     *
     * If calling this method empties the state stack, <code>Plastick.stop()</code> will be invoked.
     *
     * ```
     * // unpause the game
     * if (pauseButtonPressed) {
     *     game.popState();
     *     return;
     * }
     * ```
     *
     * @return {Boolean} This returns <code>false</code> if there is no <code>Plastick.State</code> to pop off the state stack, otherwise this returns <code>true</code>.
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
            if (this._debugMode) {
                this.debug('Popped state (' + prevState.name + ' -> ' + this.currentState().name + ')');
            }
            this._createEventListeners(state);
            state._resume(this);
        } else {
            if (this._debugMode) {
                this.debug('Popped state (' + prevState.name + ' -> [empty])');
            }
            this.stop();
        }
        return prevState !== undefined;
    };

    /**
     * This will redirect simulation from the current game state to a new game state on the next game tick by doing the following:<ul><li>Calling the current state's <code>cleanup()</code> method and destroying its event listeners</li><li>Popping the current state off the state stack</li><li>Pushing the passed State onto the state stack, making it the current state</li><li>Calling the new state's <code>init()</code> method and creating its event listeners</li></ul>
     * Note that this does not terminate execution of the current game tick. Since simulation of the new state will not begin until the next game tick, you may want to follow this by <code>return</code>ing from the update loop, or alternately place this call at the very end of your update loop.
     *
     * If calling this method empties the state stack, <code>Plastick.stop()</code> will be invoked. This may happen if the passed state is invalid and cannot be pushed onto the state stack.
     *
     * ```
     * // enter the main menu from the intro splash screen
     * if (pressedAnyKey) {
     *     game.changeState(menuState);
     *     return;
     * }
     * ```
     *
     * @param {Object} state The <code>Plastick.State</code> object to switch simulation to.
     * @return {Boolean} This returns <code>false</code> if there is no <code>Plastick.State</code> to pop off the state stack or if no valid <code>Plastick.State</code> is passed in, otherwise this returns <code>true</code>.
     * @api public
     */

    Plastick.prototype.changeState = function (state) {

        var prevState = this.currentState();

        if (prevState && state instanceof Plastick.State) {
            this.states.pop();
            prevState._cleanup(this);
            this._destroyEventListeners(prevState);

            this.states.push(state);
            if (this._debugMode) {
                this.debug('Changed state (' + prevState.name + ' -> ' + this.currentState().name + ')');
            }
            this._createEventListeners(state);
            state._init(this);
        }
        return prevState !== undefined && state instanceof Plastick.State;
    };

    /**
     * This returns the State currently being simulated.
     *
     * @return {Object} The current game state, as a <code>Plastick.State</code> object.
     * @api public
     */

    Plastick.prototype.currentState = function () {

        return this.states[this.states.length - 1];
    };

    /**
     * This returns the number of milliseconds that have passed in the game. If a time argument is passed in (milliseconds since the page session started), this instead converts that time to the equivalent game time and returns the result. Note that game time may be suspended whenever the containing browser tab is hidden.
     *
     * @param {Integer} [time] A timestamp (time since beginning of session) to convert to game time.
     * @return {Float} The number of milliseconds that have passed between now (or <code>time</code>) and the time <code>Plastick.start()</code> was called, not including "frozen" time (blurred focus).
     */

    Plastick.prototype.gameTime = function (time) {

        if (time) return time - this.startTime - this._freezeLength;
        return window.performance.now() - this.startTime - this._freezeLength;
    };

    /**
     * Performs a linear interpolation between two numeric values using <code>Plastick.tickAlpha</code>.
     *
     * ```
     * var xPos = game.lerp(sprite.prevPosition.x, sprite.currPosition.x);
     * ```
     *
     * @param {Float} before The "before" value.
     * @param {Float} after The "after" value.
     * @param {Float} [alpha] If provided, the values will be interpolated using this, instead of <code>Plastick.tickAlpha</code>. This should be a value between 0.0 and 1.0 (although other
     values will be processed respectively if you need to do so).
     * @return {Float} The result of the linear interpolation.
     */

    Plastick.prototype.lerp = function (before, after, alpha) {

        if (alpha === undefined) {
            alpha = this.tickAlpha;
        }
        return (after - before) * alpha + before;
    };

    /**
     * Returns the width of the canvas, independent of the HDPI mode. When using a Facade object, this should be equivalent to <code>Facade.width()</code>.
     *
     * ```
     * var stage = document.querySelector('canvas');
     * stage.setAttribute('width', 720);
     * stage.setAttribute('height', 480);
     * var game = new Plastick(stage);
     *
     * // displays 480
     * console.log(game.height());
     *
     * game.setHDPIMode(2);
     * // still displays 480
     * console.log(game.height());
     *
     * ```
     *
     * @return {Float} The virtual width of the canvas.
     */

    Plastick.prototype.width = function () {

        if (this.canvasMode === 'facade') this.facade.width();
        else return this.canvas.width / this.HDPIMode;
    };

    /**
     * Returns the height of the canvas, independent of the HDPI mode. When using a Facade object, this should be equivalent to <code>Facade.height()</code>.
     * @return {Float} The virtual height of the canvas.
     */

    Plastick.prototype.height = function () {

        if (this.canvasMode === 'facade') this.facade.height();
        else return this.canvas.height / this.HDPIMode;
    };

    /**
     * Toggles "debug mode". When debug mode is active, 1) calls to <code>Plastick.debug()</code> will output text to the console, 2) a global event is registered to the 'SHIFT + SPACE' key combo to call <code>Plastick.stop()</code>, and 3) state changes will be displayed with automatic <code>console.info()</code> calls.
     *
     * ```
     * game.setDebug(true);
     * ```
     *
     */

    Plastick.prototype.setDebug = function (toggle) {

        if (toggle === true && this._debugMode === false) {
            this._debugMode = true;
            document.addEventListener('keydown', this._debugStopGameEvent);
        } else if (toggle === false && this._debugMode === true) {
            this._debugMode = false;
            document.removeEventListener('keydown', this._debugStopGameEvent);
        }
    };

    /**
     * Outputs a custom debug message with a Plastick timestamp, using <code>console.info()</code>. The message will be suppressed unless debug mode is enabled with <code>Plastick.setDebug(true)</code>.
     *
     * ```
     * game.debug('Test message');
     * ```
     *
     * @param {String} info Text to be output to the console.
     */

    Plastick.prototype.debug = function (info) {

        if (this._debugMode) console.info('Plastick (' + this.currentTick + ' @ ' +
            (+this.gameTime() / 1000).toFixed(3) + 's): ' + info);
    };

    /**
     * Performs cleanup maintenance on a game that has been halted with <code>Plastick.stop()</code>.
     *
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
     * Freezes or unfreezes the game simulation (depending on the "blur" state of the web page when it's called). The example code shows how Plastick uses this method.
     *
     * ```
     * document.addEventListener(visibilityChange, this._freeze.bind(this));
     * ```
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
     * @param {Object} state The <code>Plastick.State</code> that was popped from the state stack.
     * @return {void}
     * @api private
     */

    Plastick.prototype._destroyEventListeners = function (state) {

        state.listeners.forEach(function (listener) {
            listener.element.removeEventListener(listener.eventType, listener.callback);
        });
    };

    /**
     * The main game loop. The game is simulated using a fixed time step design. <code>Plastick.State._update()</code> is called once per game tick, but several ticks could be simulated before the canvas is rendered with <code>Plastick.State._draw()</code>. Thus, the rate of the game tick simulation is decoupled from the canvas frame rate (which is governed by <code>requestAnimationFrame()</code>). If the simulation falls behind momentarily, it will try to catch up at a maximum rate of <code>Plastick.TICK_CHOKE</code> ticks per call. Below is Plastick's implementation of this game loop:
     *
     * ```
     * function () {

     *     var ticksUpdated = 0,
     *         sameState = this.currentState();
     *
     *     this._frameTime = this.gameTime();
     *     while (this._frameTime * this.TARGET_TPS / 1000 > this.currentTick &&
     *             ticksUpdated < this.TICK_CHOKE &&
     *             this._isRunning) {
     *
     *         this.currentTick += 1;
     *         ticksUpdated += 1;
     *         this.currentState()._update(this);
     *         this.tickTime = this.gameTime();
     *     }
     *     // skip draw if game was stopped (no state on the stack!)
     *     if (this._isRunning && this.currentState() === sameState) {
     *         this.tickAlpha = this.gameTime() * this.TARGET_TPS / 1000 - this.currentTick + 1;
     *         this.currentState()._draw(this);
     *     }
     * };
     * ```
     *
     * @return {void}
     * @api private
     */

    Plastick.prototype._gameLoop = function () {

        var ticksUpdated = 0,
            sameState = this.currentState();

        this._frameTime = this.gameTime();
        while (this._frameTime * this.TARGET_TPS / 1000 > this.currentTick &&
                ticksUpdated < this.TICK_CHOKE &&
                this._isRunning) {

            this.currentTick += 1;
            ticksUpdated += 1;
            this.currentState()._update(this);
            this.tickTime = this.gameTime();
        }
        // skip draw if game was stopped (no state on the stack!)
        if (this._isRunning && this.currentState() === sameState) {
            this.tickAlpha = this.gameTime() * this.TARGET_TPS / 1000 - this.currentTick + 1;
            this.currentState()._draw(this);
        }
    };

    Plastick.prototype._requestAnimationFrame = function() {

        this._gameLoop();
        if (this._isRunning)
            return window.requestAnimationFrame(this._requestAnimationFrame.bind(this));
    };

    // Plastick.State //////////////////////////////////////////////////////////

    /**
     * This represents a game state (menu, pause screen, demo screen, etc). The default behavior for the six definable methods is to do nothing. The user can redefine each one by passing it a callback method.
     *
     * ```
     * menuState = new State();
     * ```
     *
     * @param {String} [name] A label for the new state (useful when debugging).
     * @property {Object} data A generic object which the user can store any state-related data in.
     * @property {Object} methods A generic object which the user can store any state-related methods in.
     * @return {Object} A new <code>Plastick.State</code> object.
     * @api public
     */

    Plastick.State = function (name) {

        this._init = function () { return undefined; };
        this._cleanup = function () { return undefined; };
        this._update = function () { return undefined; };
        this._draw = function () { return undefined; };
        this._pause = function () { return undefined; };
        this._resume = function () { return undefined; };
        this.name = name;
        this.data = {};
        this.methods = {};
        this.listeners = [];
    };

    /**
     * This method allows the user to register an event listener with this state. All registered events are added to the page when this state is started or resumed, and they are removed from the page when this state is paused or finished.
     *
     * ```
     * menuState.registerListener(document, 'click', function() {...});
     * ```
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
     * ```
     * menuState.deregisterListener(document, 'click');
     * ```
     *
     * @param {Object} element The object to deregister the listener(s) for.
     * @param {String} type The event to deregister the listener(s) for.
     * @param {Function} [callback] The specific callback function to deregister.
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
     * ```
     * menuState.init(function() {...});
     * ```
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
     * ```
     * menuState.cleanup(function() {...});
     * ```
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
     * ```
     * menuState.update(function() {...});
     * ```
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
     * Registers a callback to the <code>draw()</code> method. This method is called by Plastick once before each canvas frame is drawn. The passed callback should contain your rendering code. You do not need to call <code>requestAnimationFrame()</code>; this is done automatically by Plastick (or by Facade if it was passed to Plastick upon construction).
     *
     * ```
     * menuState.draw(function() {
     *     game.stage.clear();
     *     for (var e = 0; e < entities.length; e += 1) {
     *     }
     * });
     * ```
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
     * ```
     * menuState.pause(function() {...});
     * ```
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
     * ```
     * menuState.resume(function() {...});
     * ```
     *
     * @param {Function} func The function to use for the <code>resume()</code> callback.
     * @return {Function} The function that was registered.
     * @api public
     */

    Plastick.State.prototype.resume = function (func) {

        if (typeof func === 'function') { this._resume = func; }
        return this._resume;
    };

    // AMD Support

    if (typeof define === 'function' && define.amd !== undefined) {
        define([], function () { return Plastick; });
    } else if (typeof module === 'object' && module.exports !== undefined) {
        module.exports = Plastick;
    } else {
        window.Plastick = Plastick;
    }

}());
