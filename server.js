const html = require('node-html-parser');
const axios = require('axios');
const striptags = require('striptags'); // not perfect, doesn't strip html entities. try 'he' ?
const addonSdk = require('stremio-addon-sdk');
//const safeEval = require('safe-eval');
//const fs = require('fs')

/*
TODO:
- only a few channels show up // might be due to broken html
- remove hidden channels or log in
- fix multiple urls (HBO USA) and single url
    - stream is inside html comment
- add 123tv.live
*/

var manifest = {
    "id": "pw.ers.tv",
    "version": "0.0.1",

    "name": "TV Channels",
    "description": "TV channels from FirstOneTV and 123TV in Discover -> Channels.",

	"icon": "http://cdn.onlinewebfonts.com/svg/download_192341.png",
    
    // set what type of resources we will return
    "resources": [
        "catalog",
        "meta",
        "stream"
    ],

    "types": ["channel"], // your add-on will be preferred for those content types

    // set catalogs, we'll be making 2 catalogs in this case, 1 for movies and 1 for series
    "catalogs": [
        {
            type: 'channel',
            id: 'fotv',
            name: 'FirstOneTV',
        },
/*        {
            type: 'tv',
            id: 'all',
            name: 'All channels',
            extraSupported: ['search', 'genre']
        },*/
    ],

    // prefix of item IDs (ie: "tt0032138")
    "idPrefixes": [ "fotv", "tv123" ],
};

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // accept self-signed certs

addon = new addonSdk(manifest);

const fotvCountriesUrl = 'https://www.firstonetv.live/Live';
const fotvBaseUrl = 'https://www.firstonetv.live';
const noPoster = ''; // 'https://images.fineartamerica.com/images/artworkimages/mediumlarge/1/vintage-tv-poster-irina-march.jpg'; // https://www.classicposters.com/images/nopicture.gif // https://vignette.wikia.nocookie.net/thaibunterng/images/7/7d/No-poster.jpg/revision/latest?cb=20180526170933&path-prefix=th

var streams = {fotv: {countries: [], all: []}, tv123: {countries: [], all: []}};

// get fotv countries
axios.get(fotvCountriesUrl).then((r) => {
    const root = html.parse(r.data);

    countryElements = root.querySelectorAll('.row.list-group .item .post-thumb');
    countryElements.forEach((value, countryIndex) => {
        var img = value.querySelector('img');
        var a = value.querySelector('a');
        var channelsSpan = value.querySelector('div.video-stats .pull-left span');
        var viewersSpan = value.querySelector('div.video-stats .pull-right span');

        var country = img.attributes.alt.trim();
        var flag = fotvBaseUrl+img.attributes.src;
        var pageUrl = fotvBaseUrl+a.attributes.href;
        var channels = channelsSpan.text.match(/[0-9]+/g);
        var viewers = viewersSpan.text.match(/[0-9]+/g);

        var channelObject = {
            id: 'fotv:'+countryIndex,
            name: country,
            genres: [country],
            type: 'channel',
            website: pageUrl,
            poster: flag,
            posterShape: 'landscape',
            background: flag,
            description: 'Channels: '+channels+', viewers: '+viewers,
            videos: []
        };

        streams.fotv.countries.push(channelObject);
        
        axios.get(pageUrl).then((r) => {
            const root = html.parse(r.data);

            channelElements = root.querySelectorAll('.row.list-group .item .post-thumb');
            channelElements.forEach((value, channelIndex) => {
                var img = value.querySelector('img');
                var a = value.querySelector('a');
                var b = a.querySelector('span span b');
                var viewsSpan = value.querySelector('div.video-stats .pull-left span');
                var viewersSpan = value.querySelector('div.video-stats .pull-right span');

                var channel = img.attributes.alt.trim();
                var poster = fotvBaseUrl+img.attributes.src;
                var page = fotvBaseUrl+a.attributes.href;
                var description = 'Channel description'//b.text;
                var views = viewsSpan.text.match(/[0-9]+/g);
                var viewers = viewersSpan.text.match(/[0-9]+/g);

/*                var channelObject = {
                    id: 'fotv:'+countryIndex+':'+channelIndex,
                    name: channel+' ('+country+')',
                    genres: [country],
                    type: 'tv',
                    page: page,
                    views: views,
                    viewers: viewers,
                    poster: poster,
                    posterShape: 'square',
                    background: noPoster,
                    description: description+' | Views: '+views+' | Viewers: '+viewers,
                    videos: []
                };
                streams.fotv.all.push(channelObject);*/

                var videoObject = {
                    id: 'fotv:'+countryIndex+':'+channelIndex,
                    /*episode: channelIndex,
                    season: countryIndex,*/
                    title: channel,
                    page: page,
                    thumbnail: poster,
                    publishedAt: new Date(),
                    streams: []
                }
                streams.fotv.countries[countryIndex].videos.push(videoObject);

                console.log('.');

            })
        })
        .catch((e) => {
            console.log(e);
        })
    })
}).catch((e) => {
    console.log(e);
})

// Catalog
addon.defineCatalogHandler((args, cb) => {
    console.log('catalog', args);

/*    if(args.id == 'all') {
        return cb(null, {metas: streams.fotv.all});
    }*/

    if(args.id == 'fotv') {
        return cb(null, {metas: streams.fotv.countries});
    } else {
        return cb(null, null);
    }
});

// Meta
addon.defineMetaHandler((args, cb) => {
    console.log('meta', args);

    var id = args.id.split(':');

    // no id
    if(id.length < 2) {
        return cb(null, {meta: {}});
    }

    // country
    if(id.length < 3) {
        console.log(streams.fotv.countries[id[1]]);
        return cb(null, {meta: streams.fotv.countries[id[1]]});
    }

    return cb(null, null);

    // country and channel
    //return cb(null, {meta: streams.fotv.countries[id[1]].videos[id[2]]});

});

// Streams
addon.defineStreamHandler((args, cb) => {
    console.log('stream', args);

    var id = args.id.split(':');

    if(id.length < 3) {
        return cb(null, null);
    }

    console.log('getting '+streams.fotv.countries[id[1]].videos[id[2]].page);
    axios.get(streams.fotv.countries[id[1]].videos[id[2]].page).then((r) => {

        var multipleStreams = r.data.match(/checkIfCanPlay\('(.+)'\)/g); //(https?:\/\/[a-zA-Z0-9./%?&=-_]+)

        var streamUrls = [];

        console.log(multipleStreams);

        if(multipleStreams.length > 0) {
            multipleStreams.forEach((value, index) => {
                let url = value.attributes.onclick;
                console.log(url);
                url = url.match(/https?:\/\/[a-zA-Z0-9./%?&=-_]+/);
                console.log('matched url: ', url);

                streamUrls.push({
                    name: 'FirstOneTV',
                    title: value.text,
                    url: url,
                    tag: ['channel'],
                    description: 'Stream description',
                    //isFree: 1
                });
            })

        }

        cb(null, {streams: streamUrls});

    })
    .catch((e) => {
        console.log(e);
        cb('Error getting streams', null);
    })
});

if (module.parent) {
    module.exports = addon;
} else {
    //addon.publishToCentral('https://tv.ers.pw/manifest.json')
    addon.runHTTPWithOptions({ port: 7001 });
}
