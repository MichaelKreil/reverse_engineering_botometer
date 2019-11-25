"use strict"

$(() => {
	const parameterCount = 39;
	const userCount = 521990;
	const width = 1920, height = 1080, retina = 2;
	var scale = height/25, xc = 0, yc = 0, queueRedraw;

	var baseUrl = window.location.href.replace(/\/+$/,'')+'/';

	var coordinates = {};
	var parameters = [];
	var currentParameter = 0;
	var names;
	const canvas = $('canvas');
	const ctx = canvas.get(0).getContext('2d');

	const sidebar = $('#sidebar');
	for (var i = 0; i < parameterCount; i++) {
		parameters[i] = {node:$('<button type="button"></button><br>').appendTo(sidebar).first()}
		if (i === currentParameter) parameters[i].node.addClass('active');
	}

	var queue = [
		cb => loadBin('coord_x.bin', data => { coordinates.x = data; cb()}),
		cb => loadBin('coord_y.bin', data => { coordinates.y = data; cb()}),
		cb => loadBin('parameter0.bin', data => initParameter(0, data, cb)),
		[0,init],
		cb => loadTxt('names.txt', data => { names = data.split(','); cb()}),
	]
	for (var i = 1; i < parameterCount; i++) (i => {
		queue.push(cb => loadBin('parameter'+i+'.bin', data => initParameter(i, data, cb)))
	})(i)
	
	runQueue(queue);

	function redraw() {
		var r = 0.015*Math.pow(scale,0.7);

		var engine = (r <= 0.56) ? drawPixels() : drawCircles();

		var p = parameters[currentParameter];

		for (var i = 0; i < userCount; i++) {
			var x = (coordinates.x[i]-xc)*scale + width/2;
			if (x < -r) continue;
			if (x >= width+r) continue;

			var y = (coordinates.y[i]-yc)*scale + height/2;
			if (y < -r) continue;
			if (y >= height+r) continue;

			var v = p.data[i];
			v = p.a*v*v + p.b*v + p.c;
			if (v < -1) v = -1;
			if (v >  1) v =  1;
			var c = [
				-109*v*v + 91*v + 255,
				-120.5*v*v - 45.5*v + 194,
				98*v*v - 76*v + 14,
				255
			]

			engine.draw(x,y,c)
		}

		engine.finish();

		//console.log(image);

		

		function drawPixels() {
			//console.log('drawPixels');
			var image = ctx.createImageData(width, height);
			image.data.fill(255, 0, width*height*4);
			return {
				draw: (x,y,c) => {
					x = Math.round(x);
					y = Math.round(y);
					if (x < 0) return;
					if (x >= width) return;
					if (y < 0) return;
					if (y >= height) return;

					var index = (y*width+x)*4;
					var o = Math.min(1, r*r*Math.PI);

					image.data[index+0] = (1-o)*image.data[index+0] + o*c[0];
					image.data[index+1] = (1-o)*image.data[index+1] + o*c[1];
					image.data[index+2] = (1-o)*image.data[index+2] + o*c[2];
					image.data[index+3] = (1-o)*image.data[index+3] + o*c[3];
				},
				finish: () => ctx.putImageData(image, 0, 0)
			}
		}
		function drawCircles() {
			//console.log('drawCircles');
			ctx.fillStyle = '#fff';
			ctx.fillRect(0,0,width, height);

			return {
				draw: (x,y,c) => {
					ctx.fillStyle = 'rgb('+c[0].toFixed(0)+','+c[1].toFixed(0)+','+c[2].toFixed(0)+')';
					ctx.beginPath()
					ctx.arc(x,y,r,0,2*Math.PI);
					ctx.fill();
				},
				finish: () => {}
			}
		}
	}

	function init(cb) {
		console.log('init');
		canvas.attr({width: width, height: height});
		canvas.css({width: width/retina, height: height/retina});

		queueRedraw = true;

		canvas.on('mousewheel', e => {
			if (e.shiftKey) return;
			e.preventDefault();

			var pos = [e.offsetX*retina-width/2, e.offsetY*retina-height/2];
			xc += pos[0]/scale;
			yc += pos[1]/scale;
			scale *= Math.exp(e.originalEvent.wheelDelta/300);
			xc -= pos[0]/scale;
			yc -= pos[1]/scale;

			queueRedraw = true;
		})

		var lastPos = false;
		canvas.on('mousedown', e => {
			if (e.shiftKey) return;
			lastPos = [e.offsetX*retina, e.offsetY*retina]
		})
		canvas.on('mousemove', e => {
			if (e.shiftKey) return;
			if (!lastPos) return;
			var pos = [e.offsetX*retina, e.offsetY*retina];
			xc -= (pos[0]-lastPos[0])/scale;
			yc -= (pos[1]-lastPos[1])/scale;
			lastPos = pos;
			queueRedraw = true;
		})
		$('body').on('mouseup', e => lastPos = false);
		canvas.on('click', e => {
			if (!names) return;
			if (!e.shiftKey) return;

			var x = (e.offsetX*retina -  width/2)/scale + xc;
			var y = (e.offsetY*retina - height/2)/scale + yc;
			var minD = sqr(10*retina/scale);
			var bestUser = -1;
			for (var i = 0; i < userCount; i++) {
				var d = sqr(coordinates.x[i]-x) + sqr(coordinates.y[i]-y)
				if (d < minD) {
					minD = d;
					bestUser = i;
				}
			}
			if (bestUser < 0) return;

			window.open('https://twitter.com/'+names[bestUser], 'twitter');
			//$('#iframe').attr('src','https://twitter.com/'+names[bestUser]);
			//console.log(names[bestUser]);
		})

		setTimeout(cb, 100);

		checkRedraw();
		function checkRedraw() {
			if (queueRedraw) {
				queueRedraw = false;
				redraw();
			}
			setTimeout(checkRedraw, 20);
		}
	}

	function runQueue(list) {
		const maxActive = 4;

		var active = 0;
		var finished = 0;
		var todo = list.slice(0);

		step()

		function step() {
			if (todo.length === 0) return;
			if (active >= maxActive) return;
			var next = todo[0];

			if (Array.isArray(next) && (active > next[0])) return;

			todo.shift();

			var func = Array.isArray(next) ? next[1] : next;
			active++;
			func(() => {
				active--;
				setTimeout(step,0);
			})
			setTimeout(step,0);
		}
		
	}

	function loadBin(filename, cb) {
		//console.log('load '+filename);
		var xhr = new XMLHttpRequest();
		xhr.open('GET', baseUrl+'data/'+filename, true);
		xhr.responseType = 'arraybuffer';
		xhr.onload = e => {
			//console.log('finished '+filename);
			cb(new Float32Array(xhr.response));
		}
		xhr.send();
	}

	function loadTxt(filename, cb) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', baseUrl+'data/'+filename, true);
		xhr.responseType = 'text';
		xhr.onload = e => cb(xhr.response);
		xhr.send();
	}

	function initParameter(index, data, cb) {
		var values = Array.from(data);
		values.sort((a,b) => a-b);

		var x0 = values[Math.round(userCount*0.01)];
		var x1 = values[Math.round(userCount*0.5)];
		var x2 = values[Math.round(userCount*0.99)];

		if (x0 === x2) {
			x0 = values[0];
			x2 = values[values.length-1];
		}

		var p = parameters[index];
		p.data = data;

		var t = (x0-x1)*(x2-x0)*(x2-x1);
		if (t === 0) {
			x0 = Math.min(x0,x1);
			x2 = Math.max(x1,x2);
			p.a = 0;
			p.b = -2/(x0-x2);
			p.c = (x2+x0)/(x0-x2);
		} else {
			p.a = (x2 - 2*x1 + x0)/t;
			p.b = -(x2*x2 - 2*x1*x1 + x0*x0)/t;
			p.c = x1*(x2*x2 - x1*x2 - x0*x1 + x0*x0)/t;
		}

		p.node.text(parameterNames[index]);
		p.node.click(() => {
			currentParameter = index;
			parameters.forEach((p,i) => p.node.toggleClass('active', i === index));
			redraw();
		})
		cb();
	}

	function sqr(v) {
		return v*v;
	}
})

const parameterNames = [
	"data.score",
	"speed",
	"data.timeline.length",
	"Math.log(speed+0.01)",
	"data.categories.content",
	"data.categories.friend",
	"data.categories.network",
	"data.categories.sentiment",
	"data.categories.temporal",
	"data.categories.user",
	"Math.log(1+data.user.location.length)",
	"Math.log(1+data.user.description.length)",
	"age(data.user)",
	"age(data.user.status)",
	"Math.log(1+data.user.followers_count)",
	"Math.log(1+data.user.friends_count)",
	"Math.log(1+data.user.listed_count)",
	"Math.log(1+data.user.favourites_count)",
	"Math.log(1+data.user.statuses_count)",
	"data.user.profile_use_background_image ? 1 : 0",
	"data.user.has_extended_profile ? 1 : 0",
	"data.user.default_profile ? 0 : 1",
	"data.user.default_profile_image ? 0 : 1",
	"age(data.timeline[0])",
	"countRatio(data.timeline, t => t.retweeted_status)",
	"countRatio(data.timeline, t => t.in_reply_to_status_id_str)",
	"countRatio(data.timeline, t => t.is_quote_status)",
	"countRatio(data.timeline, t => !(t.retweeted_status || t.in_reply_to_status_id_str))",
	"countRatio(data.timeline, t => t.entities.hashtags.length > 0)",
	"countRatio(data.timeline, t => t.entities.user_mentions.length > 0)",
	"countRatio(data.timeline, t => t.entities.urls.length > 0)",
	"countRatio(data.timeline, t => t.entities.media)",
	"countRatio(data.timeline, t => t.source.includes('instagram.com'))",
	"countRatio(data.timeline, t => t.source.includes('twitter.com'))",
	"countRatio(data.timeline, t => t.source.includes('hootsuite.com'))",
	"data.mentions.statuses.length",
	"countRatio(data.mentions.statuses, t => t.in_reply_to_user_id_str === data.user.id_str)",
	"age(data.mentions.statuses[0])",
	"isBot",
]