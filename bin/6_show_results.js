"use strict"

const fs = require('fs');
const async = require('async');
const miss = require('mississippi2');

var users = [];
var parameters = [];
var count = 521990;

async.series([
	loadUsers,
	loadCoordinates,
	filter,
	saveSVG,
	saveJS,
], () => console.log('Finished'))

function loadUsers(cb) {
	console.log('load users');

	var i = 0;
	miss.pipe(
		fs.createReadStream('../data/all_users.tsv'),
		miss.split(),
		miss.to.obj((chunk, enc, next) => {
			if (!chunk) return next(null);
			chunk = chunk.split('\t');
			users[i] = {name: chunk[0], score: parseFloat(chunk[1])};
			chunk.shift();
			chunk.forEach((v,j) => {
				if (!parameters[j]) parameters[j] = new Float32Array(count);
				parameters[j][i] = parseFloat(v);
			})
			i++;
			next(null);
		}),
		() => {
			if (i !== count) throw Error(i);
			cb()
		}
	)
}

function loadCoordinates(cb) {
	console.log('load coordinates');
	var data = fs.readFileSync('../data/all_users_2d.tsv', 'utf8').split('\n');
	data.forEach((l,i) => {
		if (!l) return;
		l = l.split('\t');
		users[i].x =  parseFloat(l[1]);
		users[i].y = -parseFloat(l[0]);
	})

	var minX = 1e10, maxX = -1e10;
	var minY = 1e10, maxY = -1e10;
	users.forEach(u => {
		if (minX > u.x) minX = u.x;
		if (maxX < u.x) maxX = u.x;
		if (minY > u.y) minY = u.y;
		if (maxY < u.y) maxY = u.y;
	})

	var cx = (maxX+minX)/2;
	var cy = (maxY+minY)/2;
	users.forEach(u => {
		u.x -= cx;
		u.y -= cy;
	});

	cb();
}

function filter(cb) {
	console.log('add score parameter');

	var p = new Float32Array(count);
	parameters[0].forEach((v,i) => {
		if (v < 0.75) return p[i] = 0;
		//if (v > 0.75) return p[i] = 1;
		p[i] = 1;
	})
	parameters.push(p);


	cb();
}

function saveSVG(cb) {
	console.log('save SVG');

	var size = 1000;
	var scale = 25;
	var svg = [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="'+size+'px" height="'+size+'px" viewBox="0 0 '+size+' '+size+'" style="enable-background:new 0 0 '+size+' '+size+';" xml:space="preserve">'
	]

	var groups = new Map();

	users.forEach(u => {
		var x = u.x * scale + size/2;
		var y = u.y * scale + size/2;
		var color = '#3777bc';
		if (u.score > 0.50) color = '#ffc20e';
		if (u.score > 0.75) color = '#ed1c24';
		svg.push('<circle cx="'+x.toFixed(3)+'" cy="'+y.toFixed(3)+'" r="0.1" fill="'+color+'" />');

		var val = Math.floor(u.score*4)/4;
		var key = val.toFixed(2);
		if (!groups.has(key)) groups.set(key, {key:key, val:val, count:0})
		groups.get(key).count++;
	})
	svg.push('</svg>');
	fs.writeFileSync('result.svg', svg.join('\n'), 'utf8');

	groups = Array.from(groups.values());
	groups.sort((a,b) => a.val - b.val);
	groups.forEach(g => console.log([g.key, g.count].join('\t')));

	cb();
}


function saveJS(cb) {
	console.log('save JS');

	fs.writeFileSync('../docs/data/names.txt', users.map(u => u.name).join(','), 'utf8');

	fs.writeFileSync('../docs/data/coord_x.bin', Buffer.from(Float32Array.from(users.map(u => u.x)).buffer));
	fs.writeFileSync('../docs/data/coord_y.bin', Buffer.from(Float32Array.from(users.map(u => u.y)).buffer));

	parameters.forEach((p,j) => {
		console.log('write parameter'+j+'.bin');
		fs.writeFileSync('../docs/data/parameter'+j+'.bin', Buffer.from(p.buffer));
	})

	cb();
}



