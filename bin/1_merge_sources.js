"use strict"

const fs = require('fs');
const child_process = require('child_process');
const miss = require('mississippi2');
const resolve = require('path').resolve;

const sourcePath = resolve(__dirname, '../data/source');

var files = new Map();

console.log('scan directory');

fs.readdirSync(sourcePath).forEach(f => {
	var party = f.match(/^(.*)_followers/);
	if (!party) throw Error(f);
	party = party[1];

	var n = f.match(/followers_(\d+)\./);
	if (!n) throw Error(f);
	n = n[1];

	var type = f.endsWith('.tsv') ? 1 : f.endsWith('.ndjson.xz') ? 2 : 0;
	if (type < 1) throw Error(f);

	var id = party+'_'+n;

	if (!files.has(id)) files.set(id, {
		party:party,
		n:n,
		id:id,
		tsv: false,
		ndjson: false,
	})

	var obj = files.get(id)

	if (type === 1) obj.tsv = f;
	if (type === 2) obj.ndjson = f;
})

files = Array.from(files.values());

files.forEach(f => {
	if (!f.tsv || !f.ndjson) throw Error(f);
})
//files = files.slice(0,1);
console.log('files: '+files.length);

files.sort((a,b) => a.id < b.id ? -1 : 1);

var users = new Map();

console.log('scan users');

files.forEach(f => {
	var data = fs.readFileSync(resolve(sourcePath, f.tsv), 'utf8');
	data.split('\n').forEach(l => {
		l = l.split('\t')[0].toLowerCase();

		if (!users.has(l)) users.set(l, {name:l, parties:new Set()});
		users.get(l).parties.add(f.party.toLowerCase());
	})
})

var args = files.map(f => resolve(sourcePath, f.ndjson));
args.unshift('-dkc');

var xz_in  = child_process.spawn('xz', args);
var xz_out = child_process.spawn('xz', ['-zk9']);

var maxCount = users.size;
var count = 0;

miss.pipeline(
	xz_in.stdout,
	miss.split('\n'),
	miss.through.obj(
		(data, enc, cb) => {
			data = JSON.parse(data);
			var id = data.user.screen_name.toLowerCase();
			if (!users.has(id)) return cb(null);
			data.parties = Array.from(users.get(id).parties.values());
			users.delete(id);

			if (count % 1000 === 0) console.log((100*count/maxCount).toFixed(2)+'%');
			count++;


			cb(null, JSON.stringify(data)+'\n');
		}
	),
	miss.duplex(xz_out.stdin, xz_out.stdout),
	fs.createWriteStream(resolve(__dirname, '../data/all_users.ndjson.xz'))
)




