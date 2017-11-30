'use strict';

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var stylish = require('jshint-stylish');

gulp.task('scripts', function () {
    return gulp.src(
        [
            'scripts/angular-datepicker-light.js',
            'scripts/app.js'
        ])
        .pipe(plugins.jshint({camelcase: true, unused: 'strict'}))
        .pipe(plugins.jshint.reporter(stylish))
        .pipe(plugins.uglify())
        .pipe(plugins.rename({extname: '.min.js'}))
        .pipe(gulp.dest('./dist'));
});

gulp.task('documentation', function () {
    return gulp.src('./scripts/angular-datepicker-light.js')
        .pipe(plugins.documentation('json', {filename: 'docs.json'}))
        .pipe(gulp.dest('./'));
});

gulp.task('watch', function () {
    gulp.watch([
        'scripts/angular-datepicker-light.js',
        'scripts/app.js'
    ], ['scripts', 'documentation']);
});

gulp.task('default', ['scripts', 'documentation', 'watch']);
