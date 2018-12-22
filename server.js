const html = require('node-html-parser');
const axios = require('axios');
const striptags = require('striptags'); // not perfect, doesn't strip html entities. try 'he' ?
const addonSdk = require('stremio-addon-sdk');
const safeEval = require('safe-eval');
const fs = require('fs')

/*
TODO:
- try firstonetv.net, seems to work.
*/

const baseUrl = 'https://www.firstonetv.net';
const noPoster = '', // 'https://images.fineartamerica.com/images/artworkimages/mediumlarge/1/vintage-tv-poster-irina-march.jpg'; // https://www.classicposters.com/images/nopicture.gif // https://vignette.wikia.nocookie.net/thaibunterng/images/7/7d/No-poster.jpg/revision/latest?cb=20180526170933&path-prefix=th

var manifest = {
    "id": "pw.ers.tv",
    "version": "0.0.1",

    "name": "TV Addon",
    "description": "Movie channels, series channels and US cable tv channels from FirstOneTV",

	"icon": "http://cdn.onlinewebfonts.com/svg/download_192341.png",
    
    // set what type of resources we will return
    "resources": [
        "catalog",
        "meta",
        "stream"
    ],

    "types": ["tv"], // your add-on will be preferred for those content types

    // set catalogs, we'll be making 2 catalogs in this case, 1 for movies and 1 for series
    "catalogs": [
        {
            type: 'tv',
            id: 'countries',
            name: 'Countries',
            extraSupported: ['search', 'genre']
        },
        {
            type: 'tv',
            id: 'all',
            name: 'All channels',
            extraSupported: ['search', 'genre']
        },
    ],

    // prefix of item IDs (ie: "tt0032138")
    "idPrefixes": [ "fotv" ],
};

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // accept self-signed certs

addon = new addonSdk(manifest);

// prepare data
var streams = {featured: [], shows: [], movies: [], cable: []};
axios.get(baseUrl)
.then((r) => {
    const root = html.parse(r.data);

    streams.fotv.countries = root.querySelectorAll('.stream-list-featured a.poster-link');
    streams.fotv.countries.forEach((value, index) => {
        //var poster = baseUrl+value.querySelector('img').attributes.src;
        streams.fotv.countries[index] = {id: 'fotv:featured:'+index, name: value.attributes.title, genres: ['tv'], type: 'tv', page: baseUrl+'/'+value.attributes.href, poster: '', background: noPoster, videos: [{id: 0, title: 'title', thumbnail: noPoster, publishedAt: new Date(), streams: [{url: 'https://'}]}], description: 'description'};
    });

    return streams;
})
.catch((e) => {
    console.log(e);
})

// Catalog
addon.defineCatalogHandler((args, cb) => {
    console.log('catalog', args);

    var id = args.id.split(':');

    if(id.length < 2) {
        cb(null, {meta: []});
        return;
    }

    return cb(null, {metas: streams[id[1]]}); 
});

// Meta
addon.defineMetaHandler((args, cb) => {
    console.log('meta', args);

    var id = args.id.split(':');

    if(id.length < 3) {
        cb(null, {meta: {}});
        return;
    }

    return cb(null, {metas: streams[id[1]][id[2]]});

});




// Streaming
addon.defineStreamHandler((args, cb) => {
    console.log('stream', args);

    console.log('id', args.id);

    var id = args.id.split(':');

    if(id.length < 3) {
        cb(null, {streams: []});
        return;
    }

    console.log('getting '+streams[id[1]][id[2]].page);
    axios.get(streams[id[1]][id[2]].page)
    .then((r) => {

        let streamUrls = [
            {
                name: 'ArconaiTV',
                title: streams[id[1]][id[2]].name,
                url: 'file:///D:/Projects/Node/stremio-tv/public/stream.m3u8',
                tag: ['tv'],
                description: 'desc',
                //isFree: 1
            }
        ];

        cb(null, {streams: streamUrls});

    })
    .catch((e) => {
        console.log(e);
    })
});

if (module.parent) {
    module.exports = addon
} else {
    //addon.publishToCentral('https://tv.ers.pw/manifest.json')
    addon.runHTTPWithOptions({ port: 7001 });
}
