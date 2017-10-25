// Dependencies
const gulp = require('gulp'),
	pkg = require('./package.json'),
	sass = require('gulp-sass'),
	autoprefixer = require('gulp-autoprefixer'),
	header = require('gulp-header'),
	pixrem = require('gulp-pixrem'),
	uglify = require('gulp-uglify'),
	wait = require('gulp-wait'),
	rename = require('gulp-rename'),
	minifyCss = require('gulp-clean-css'),
	frontMatter = require('gulp-front-matter'),
	data = require('gulp-data'),
	sourcemaps = require('gulp-sourcemaps'),
	del = require('del'),
	browserSync = require('browser-sync'),
	reload = browserSync.reload,
	browserify = require('browserify'),
	imagemin = require('gulp-imagemin'),
	notify = require('gulp-notify'),
	plumber = require('gulp-plumber'),
	gulpIf = require('gulp-if'),
	babelify = require('babelify'),
	gulpUtil = require('gulp-util'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),
	runSequence = require('run-sequence'),
	nunjucksRender = require('gulp-nunjucks-render');

// Banner
const banner = [
	'/**',
	' * @name <%= pkg.name %>: <%= pkg.description %>',
	' * @version <%= pkg.version %>: <%= new Date().toUTCString() %>',
	' * @author <%= pkg.author %>',
	' * @license <%= pkg.license %>',
	' */'
].join('\n');

// Error notification
function onError(err) {
	notify.onError({
		title:    'Gulp',
		subtitle: 'Failure!',
		message:  'Error: <%= error.message %>',
		sound:    'Beep'
	})(err);

	this.emit('end');
}

//------------------------
// Configuration
//------------------------

// Autoprefixer settings
const AUTOPREFIXER_BROWSERS = [
	'ie >= 9',
	'ie_mob >= 10',
	'ff >= 20',
	'chrome >= 4',
	'safari >= 7',
	'opera >= 23',
	'ios >= 7',
	'android >= 4.4',
	'bb >= 10'
];

// Build root destination / webroot for serve
const staticOutputDir = './build';
const dynamicOutputDir = '../Production/src/GlasgowLifeConventions/GlasgowLifeConventions';

// Asset destination base path
const assetPath = '/static';

// Paths for source and destinations
const paths = {
	src: {
		css: './src/scss/',
		js: './src/js/',
		html: './src/templates/',
		img: './src/img/',
		fonts: './src/fonts/'
	},
	dest: {
		development: {
			css: `${staticOutputDir}${assetPath}/css/`,
			js:  `${staticOutputDir}${assetPath}/js/`,
			html: staticOutputDir,
			img: `${staticOutputDir}${assetPath}/img/`,
			fonts: `${staticOutputDir}${assetPath}/fonts/`
		},
		production: {
			css: `${dynamicOutputDir}${assetPath}/css/`,
			js:  `${dynamicOutputDir}${assetPath}/js/`,
			html: staticOutputDir,
			img: `${dynamicOutputDir}${assetPath}/img/`,
			fonts: `${dynamicOutputDir}${assetPath}/fonts/`
		},

	}
};

//------------------------
// Tasks
//------------------------

function clean() {
	return del(`${paths.dest}`);
}

function jsCore(){
	return browserify({
		entries: `${paths.src.js}app.js`,
		debug: !gulpUtil.env.production,
		fullPaths: !gulpUtil.env.production
	})
	.transform(babelify, {
		"presets": [
			[
				"env", 
				{
					"targets": {
						"browsers": ["last 2 versions", "safari >= 7"]
					}
				}
			]
		]
	})
	.bundle()
	.pipe(source('app.js'))
	.pipe(buffer())
	.pipe(gulpIf(!!gulpUtil.env.production, uglify()))
	.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].js));
}

function jsAsync(){
	return gulp.src(`${paths.src.js}async/**/*`)
		.pipe(uglify())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest(`${paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].js}async/`));
}

function jsPolyfills(){
	return browserify({
		entries: `${paths.src.js}polyfills/index.js`,
		debug: !gulpUtil.env.production,
		fullPaths: !gulpUtil.env.production
	})
	.bundle()
	.pipe(source('index.js'))
	.pipe(buffer())
	.pipe(uglify())
	.pipe(rename({
		basename: 'polyfills',
		suffix: '.min'
	}))
	.pipe(gulp.dest(`${paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].js}async/`));
}

function sw(){
	return gulp.src(`${paths.src.js}/sw/*.*`)
	.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].html));
}

function html(){
	return gulp.src(`${paths.src.html}views/**/*.html`)
		.pipe(plumber({errorHandler: onError}))
		.pipe(frontMatter({ property: 'data' }))
		.pipe(data(() => {
			return {'assetPath': assetPath};
		}))
		.pipe(nunjucksRender({
			path: paths.src.html
		}))
		.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].html));
}

function scss(){
	return gulp.src([`${paths.src.css}**/*.scss`, `!${paths.src.css}{fonts,kss}/*.*`])
		.pipe(wait(500))
		.pipe(plumber({errorHandler: onError}))
		.pipe(sourcemaps.init())
		.pipe(sass())
		.pipe(autoprefixer(AUTOPREFIXER_BROWSERS))
		.pipe(pixrem())
		.pipe(header(banner, {pkg : pkg}))
		.pipe(sourcemaps.write())
		.pipe(gulpIf(!!gulpUtil.env.production, minifyCss()))
		.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].css));
}

function img(){
	return gulp.src(`${paths.src.img}**/*`)
		.pipe(imagemin({
			progressive: true,
			interlaced: true,
			svgoPlugins: [{removeViewBox: true}]
		}))
		.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].img));
}

function fonts(){
	return gulp.src(`${paths.src.fonts}**/*.*`)
	.pipe(gulp.dest(paths.dest[!!gulpUtil.env.production ? 'production' : 'development'].fonts));
}

function serve(){
	browserSync({
		notify: false,
		// https: true,
		server: [staticOutputDir],
		tunnel: false
	});
	watch(reload);
}

function watch(cb){
	const watchers = [
		{
			glob: `${paths.src.html}**/*.html`,
			tasks: ['html']
		},
		{
			glob: `${paths.src.css}**/*.scss`,
			tasks: ['scss']
		},
		{
			glob: `${paths.src.img}**/*`,
			tasks: ['img']
		},
		{
			glob: `${paths.src.js}**/*`,
			tasks: ['js']
		}
	];
	watchers.forEach(watcher => {
		cb && watcher.tasks.push(cb);
		gulp.watch(watcher.glob, watcher.tasks);
	});
}

//------------------------
// Gulp API
//------------------------
gulp.task('compile', () => {
	runSequence('clean', ['js', 'scss', 'img', 'html', 'fonts']);
});

gulp.task('jsCore', jsCore);
gulp.task('jsAsync', jsAsync);
gulp.task('jsPolyfills', jsPolyfills);
gulp.task('sw', sw);

gulp.task('clean', clean);
gulp.task('js', ['sw', 'jsCore', 'jsAsync', 'jsPolyfills']);
gulp.task('html', html);
gulp.task('scss', scss);
gulp.task('img', img);
gulp.task('fonts', fonts);
gulp.task('serve', () => {
	runSequence('clean', ['js', 'scss', 'img', 'html', 'fonts'], serve);
});
gulp.task('watch', () => {
	runSequence('compile', watch);
});
gulp.task('default', ['serve']);
