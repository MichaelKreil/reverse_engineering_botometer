"use strict"

const fs = require('fs');
const miss = require('mississippi2');
const resolve = require('path').resolve;

const source = resolve(__dirname, '../data/all_users.tsv');

console.log('load file');

var data = fs.readFileSync(source, 'utf8').split('\n');

console.log('parse file');
data.pop();
data = data.map(l => l.split('\t').slice(1).map(v => parseFloat(v)));


console.log('scale input variables');

var colCount = data[0].length;
console.log(colCount);

for (var c = 1; c < colCount; c++) {
	console.log('   '+(c-1)+'/'+(colCount-1));

	var s0 = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
	data.forEach(e => {
		var x = e[c];
		var y = e[0];
		s0 += 1;
		sx += x;
		sy += y;
		sxx += x*x;
		sxy += x*y;
		syy += y*y;
	})
	sx /= s0;
	sy /= s0;
	sxx /= s0;
	sxy /= s0;
	syy /= s0;
	var b = (sxy-sx*sy)/(sxx-sx*sx);
	var a = sy-b*sx;
	var varxy = Math.sqrt(syy-(sxx*sy*sy-2*sx*sxy*sy+sxy*sxy)/(sxx-sx*sx));
	var varx  = Math.sqrt(sxx-sx*sx);
	var vary  = Math.sqrt(syy-sy*sy);

	var f = b*(1-varxy/vary);
	//var f = 0.1/varx;
	data.forEach(e => e[c] = (e[c]-sx)*f);
}

console.log('save file');
miss.pipeline(
	miss.from((size, next) => {
		if (data.length === 0) return next(null, null);
		next(null, data.slice(0,10000).map(e => e.join('\t')+'\n').join(''))
		data = data.slice(10000);
	}),
	fs.createWriteStream(resolve(__dirname, '../data/all_users_normalized.tsv'))
);


