[![online documentation](http://doxdox.herokuapp.com/images/badge.svg)](http://doxdox.herokuapp.com/syntaxtsb/plastick.js)

Plastick.js
===========

Plastick.js is a _lightweight, time-accurate game loop framework_ for JavaScript, utilizing [Facade.js](https://github.com/facadejs/Facade.js).

Plastick's game loop is simulated using a **fixed time step** design, and is decoupled from the rendering performance of the canvas. This allows the game time to continue to be simulated accurately when the canvas framerate drops. There is support for **tick interpolation**, to reduce temporal alising and render game ticks more smoothly. Plastick can also automatically freeze simulation while the game's page is hidden (when the user switches browser tabs).

Plastick implements a **state stack**, which allows a game developer to easily organize the logic of various game states (splash screen, menu, gameplay, demo screen, pause screen, etc). Each state has it's own update loop, draw loop, and event listeners. When the game needs to change states, Plastick will painlessly handle the logistics of the transition.

Installation
------------

* Install [Facade.js](https://github.com/facadejs/Facade.js), a 2D-canvas drawing library.
* Place plastic.min.js into your project folder.

Usage
-----

This is an example of a basic game loop, where the current game tick is recorded to the console on each tick (the canvas is not being used):
```
var stage = new Facade(document.querySelector('canvas')),
    game = new Plastick(stage),
    state = new Plastick.State();

// register an event handler for stopping the game with the space bar
state.registerListener(document, 'keydown', function (e) {
    if (e.keyCode === 32) game.stop();
});

// register update loop for game state
state.update(function () {

    console.log(game.currentTick);
});

// start the game using the game state we defined
game.start(state);
```
