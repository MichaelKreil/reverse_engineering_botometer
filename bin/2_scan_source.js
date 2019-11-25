"use strict"

const fs = require('fs');
const child_process = require('child_process');
const miss = require('mississippi2');
const resolve = require('path').resolve;

const source = resolve(__dirname, '../data/all_users.ndjson.xz');
const now = Date.parse('2019-06-13');
const userCount = 521990;
var userIndex = 0;

console.log('scan file');

var xz_in  = child_process.spawn('xz', ['-dkc', source]);

miss.pipeline(
	xz_in.stdout,
	/*
	(() => {
		var buffer1 = [], buffer2 = [], finished = false;
		return miss.duplex(
			miss.to(
				function write(data, enc, cb) {
					//console.log('write '+buffer1.length+'/'+buffer2.length);
					do {
						var i = data.indexOf(10);
						if (i < 0) break;
						buffer1.push(data.slice(0,i));
						buffer2.push(Buffer.concat(buffer1).toString('utf8'));
						buffer1 = [];
						data = data.slice(i+1);
					} while (true);
					buffer1.push(data);
					waitFor(
						() => buffer2.length < 100,
						() => cb(null)
					)
				},
				function flush(cb) {
					finished = true;
					cb(null)
				}
			),
			miss.from.obj(
				function read(size, next) {
					//console.log('read '+buffer1.length+'/'+buffer2.length);
					waitFor(
						() => (buffer2.length > 0) || finished,
						() => {
							if (buffer2.length > 0) return next(null, buffer2.shift());
							if (finished) return next(null, null);
						}
					)
				}
			)
		)

		function waitFor(check, func) {
			run()
			function run() {
				if (check()) return func();
				setTimeout(run, 10);
			}
		}
	})(),*/
	miss.split('\n'),
	miss.through.obj(
		(data, enc, cb) => {
			if (userIndex % 1000 === 0) console.log((100*userIndex/userCount).toFixed(2)+'%');
			userIndex++;

			data = JSON.parse(data);

			var speed = 0;
			if (data.timeline.length > 1) {
				var duration = (Date.parse(data.timeline[0].created_at) - Date.parse(data.timeline[data.timeline.length-1].created_at))/86400000
				speed = (data.timeline.length-1)/(duration+0.003);
			}

			data = [
				data.user.screen_name,
				data.score,
				speed,
				data.timeline.length,
				Math.log(speed+0.01),
				data.categories.content,
				data.categories.friend,
				data.categories.network,
				data.categories.sentiment,
				data.categories.temporal,
				data.categories.user,
				Math.log(1+data.user.location.length),
				Math.log(1+data.user.description.length),
				age(data.user),
				age(data.user.status),
				Math.log(1+data.user.followers_count),
				Math.log(1+data.user.friends_count),
				Math.log(1+data.user.listed_count),
				Math.log(1+data.user.favourites_count),
				Math.log(1+data.user.statuses_count),
				data.user.profile_use_background_image ? 1 : 0,
				data.user.has_extended_profile ? 1 : 0,
				data.user.default_profile ? 0 : 1,
				data.user.default_profile_image ? 0 : 1,
				age(data.timeline[0]),
				countRatio(data.timeline, t => t.retweeted_status),
				countRatio(data.timeline, t => t.in_reply_to_status_id_str),
				countRatio(data.timeline, t => t.is_quote_status),
				countRatio(data.timeline, t => !(t.retweeted_status || t.in_reply_to_status_id_str)),
				countRatio(data.timeline, t => t.entities.hashtags.length > 0),
				countRatio(data.timeline, t => t.entities.user_mentions.length > 0),
				countRatio(data.timeline, t => t.entities.urls.length > 0),
				countRatio(data.timeline, t => t.entities.media),
				countRatio(data.timeline, t => t.source.includes('instagram.com')),
				countRatio(data.timeline, t => t.source.includes('twitter.com')),
				countRatio(data.timeline, t => t.source.includes('hootsuite.com')),
				data.mentions.statuses.length,
				countRatio(data.mentions.statuses, t => t.in_reply_to_user_id_str === data.user.id_str),
				age(data.mentions.statuses[0]),
			]

			cb(null, data.join('\t')+'\n');
		}
	),
	(function () {
		var buffer = [], size = 0;
		return miss.through.obj(
			(chunk, enc, next) => {
				buffer.push(chunk);
				size += chunk.length;
				if (size < 1e7) return next(null, null);

				next(null, buffer.join(''));
				buffer = [];
				size = 0;
			},
			(next) => {
				if (size === 0) return next(null, null);
				next(null, buffer.join(''));
			}
		)
	})(),
	fs.createWriteStream(resolve(__dirname, '../data/all_users.tsv'))
)

function countRatio(list, filter) {
	if (!list) return 0;
	if (list.length === 0) return 0;
	var n = 0;
	list.forEach(t => {
		if (filter(t)) n++;
	})
	return n/list.length;
}

function age(element) {
	var age = 10*365;
	if (element && element.created_at) {
		var age = now-Date.parse(element.created_at);
		age = age/(86400000);
	}
	if (age <= 0) age = 0;
	return Math.log(1+age);
}

function decodeColor(text) {
	return [
		parseInt(text.slice(0,2), 16),
		parseInt(text.slice(2,4), 16),
		parseInt(text.slice(4,6), 16),
	]
}