module.exports = function (grunt) {

    'use strict';

    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jslint: {
            client: {
                src: ['plastick.js'],
                directives: {
                    nomen: true,
                    globals: {
                        'document': true,
                        'define': true,
                        'module': true,
                        'require': true,
                        'window': true
                    }
                }
            }
        },
        uglify: {
            my_target: {
                options: {
                    mangle: true,
                    report: 'gzip',
                    banner: '/*!\n * <%= pkg.name %> v<%= pkg.version %> <%= grunt.template.today("isoDateTime") %>\n * https://github.com/syntaxtsb/plastick.js\n * \n * Copyright (c) <%= grunt.template.today("yyyy") %> Travis Beebe\n * Released under the MIT license.\n */\n'
                },
                files: {
                    'plastick.min.js': ['plastick.js']
                }
            }
        },
        shell: {
            buildDoc: {
                command: 'dox < Plastick.js > docs/Plastick.json; cd docs/; doxdox.py --title="Plastick" --description="A lightweight, time-accurate game loop framework for Javascript." > index.html; rm Plastick.json'
            }
        },
        jasmine: {
            test: {
                src: 'plastick.min.js',
                options: {
                    specs: 'tests/*.js'
                }
            }
        },
        watch: {
            default: {
                files: ['plastick.js'],
                tasks: ['jslint', 'uglify', 'shell']
            }
        }
    });

    grunt.registerTask('default', [ 'jslint', 'uglify', 'shell' ]);
    grunt.registerTask('test', [ 'jasmine' ]);

};