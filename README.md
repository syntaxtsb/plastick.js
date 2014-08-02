Plastick.js
===========

Plastick.js is a _lightweight, time-accurate game loop framework_ for JavaScript, utilizing [Facade.js](https://github.com/facadejs/Facade.js).

Plastick's game loop is simulated using a **fixed timestep** architecture, and is decoupled from the rendering performance of the canvas. This allows the game time to continue to be simulated accurately when the canvas framerate drops. Plastick can also automatically freeze simulation while the game's page is hidden (when the user switches browser tabs).

Plastick implements a **state stack**, which allows a game developer to easily organize the logic of various game states (splash screen, menu, gameplay, demo screen, pause screen, etc). Each state has it's own update loop, draw loop, and event listeners. When the game needs to change states, Plastick will painlessly handle the logistics of the transition.

Installation
------------

* Install [Facade.js](https://github.com/facadejs/Facade.js), a 2D-canvas drawing library.
* Place plastic.min.js into your project folder.


Usage
-----

Documentation can be accessed [online](http://rawgit.com/syntaxtsb/plastic.js/master/doc/index.html) or in the /doc folder.
