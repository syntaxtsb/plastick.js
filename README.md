Plastick.js
===========

Plastick.js is a _lightweight, time-accurate game loop framework_ for JavaScript, utilizing Facade.js.

Plastick's game loop is simulated using a **fixed timestep** architecture, and is decoupled from the rendering performance of the canvas. This allows the game time to continue to be simulated accurately when the canvas framerate drops. Plastick can also automatically freeze simulation while the game's page is hidden (when the user switches browser tabs).

Plastick implements a **state stack**, which allows a game developer to easily organize the logic of various game states (splash screen, menu, gameplay, demo screen, pause screen, etc). Each state has it's own update loop, draw loop, and event listeners. When the game needs to change states, Plastick will painlessly handle the logistics of the transition.

Installation
------------

* Install [Facade.js](https://github.com/facadejs/Facade.js), a 2D-canvas drawing library.
* Place plastic.min.js into your project folder.


Usage
-----

**Plastick(_stage_)**

Create a Plastick object for your game by passing it the Facade object that will be used to draw to the canvas. The Plastick object automatically controls the update loop and draw loop for your game project, and transfers the game simulation between various States.

**Plastick.start(_state_)**

This will initialize the game with a pre-defined game state and start simulating the game.

This returns false if no valid State is passed in or if the game was already running, otherwise it returns true.

**Plastick.stop()**

This will immediately halt simulation of the game and clear the entire state stack.

This returns false if the game was not already running, otherwise it returns true.

**Plastick.pushState(_state_)**

This will pause the current game state and start simulation of a new game state by doing the following:

* Pause simulation of the current state by calling its `pause()` method and destroying its event listeners
* Push the passed State onto the state stack, making it the current state
* Call the new state's `init()` method and create its event listeners

This returns false if no valid State is passed in, otherwise it returns true.

**Plastick.popState()**

This will end the current game state and resume simulation of the previous game state by doing the following:

* End simulation of the current state by calling its `cleanup()` method and destroying its event listeners
* Pop the current state off the state stack, making the prior state the current state
* Call the prior state's `resume()` method and create its event listeners

If calling this method empties the state stack, `Plastick.stop()` will be invoked.

This returns false if there is no state to pop off the state stack, otherwise this returns true.

**Plastick.changeState(_state_)**

This will redirect simulation from the current game state to a new game state by doing the following:

* End simulation of the current state by calling its `cleanup()` method and destroying its event listeners
* Pop the current state off the state stack and push the passed State onto the state stack, making it the current state
* Call the new state's `init()` method and create its event listeners

If calling this method empties the state stack, `Plastick.stop()` will be invoked. This may happen if the passed state is invalid and cannot be pushed onto the state stack.

This returns false if there is no state to pop off the state stack or if no valid State is passed in, otherwise this returns true.

**Plastick.currentState()**

This returns the State currently being simulated.

**Plastick.gameTime()**

This returns the number of milliseconds that has passed in the game. Note that game time may be suspended whenever the containing browser tab is hidden.

**Plastick.State()**

This represents a game state (menu, pause screen, demo screen, etc). The default behavior for each method is to do nothing. The developer can redefine each one by passing it a callback method.

**Plastick.State.registerListener(_element, type, callback_)**

This method allows the developer to register an event listener with this state. All registered events are added to the page when this is the current state, and removed from the page when this state is paused or finished.

**Plastick.State.deregisterListener(_element, type, callback_)**

This method allows the developer to deregister an event listener with this state. If the callback parameter is omitted, all callbacks linked to the specified element-event combination are deregistered.

**Plastick.State.init(_func_)**

This method is called by Plastick whenever this state is added to the state stack.

**Plastick.State.cleanup(_func_)**

This method is called by Plastick whenever this state is removed from the state stack.

**Plastick.State.update(_func_)**

This method is called by Plastick once during each game tick. The passed callback should contain your main game loop, and as part of a fixed timestep design it should always simulate a constant amount of game time. _In order to maintain accurate timing in your game, Plastick may call this multiple times between each canvas frame._

**Plastick.State.draw(_func_)**

This method is called by Plastick once before each canvas frame is drawn. The passed callback should contain your rendering code. You do _not_ need to call renderAnimationFrame(); this is done automatically by Plastick's Facade object.

**Plastick.State.pause(_func_)**

This method is called by Plastick when this state is the current state and is being suspended to begin simulation of a new state.

**Plastick.State.resume(_func_)**

This method is called by Plastick when this state is suspended and is resuming simulation as the current state.
