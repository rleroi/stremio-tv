const html = require('node-html-parser');
const axios = require('axios');
const striptags = require('striptags'); // not perfect, doesn't strip html entities. try 'he' ?
const addonSdk = require('stremio-addon-sdk');
const safeEval = require('safe-eval');
const fs = require('fs')

/*
TODO:
- NOT WORKING in stremio, stops after a few seconds. m3u8 file contains ts files that are only valid for a few seconds (ts segment files), VLC seems to reload the m3u8 file, stremio doesn't.
    - does stremio use hls.js? https://github.com/video-dev/hls.js/issues/1850
    - In vlc it works, but only if you use the option :http-user-agent="" to remove 'VLC' from the user-agent.
- replace eval with safe-eval. safe-eval doesn't work yet
*/

const baseUrl = 'https://www.arconaitv.us';
const noPoster = 'https://images.fineartamerica.com/images/artworkimages/mediumlarge/1/vintage-tv-poster-irina-march.jpg'; // https://www.classicposters.com/images/nopicture.gif // https://vignette.wikia.nocookie.net/thaibunterng/images/7/7d/No-poster.jpg/revision/latest?cb=20180526170933&path-prefix=th

var manifest = {
    "id": "pw.ers.tv",
    "version": "0.0.1",

    "name": "TV Addon",
    "description": "Movie channels, series channels and US cable tv channels from ArconaiTV",

	"icon": "http://cdn.onlinewebfonts.com/svg/download_192341.png", //"https://www.iconsdb.com/icons/download/gray/tv-128.png", //"http://cdn.onlinewebfonts.com/svg/download_192341.png", //"https://www.iconsdb.com/icons/preview/red/tv-xxl.png",
	
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
            id: 'featured',
            name: 'Featured',
            extraSupported: ['search', 'genre']
        },
        {
            type: 'tv',
            id: 'shows',
            name: 'Series',
        },
        {
            type: 'tv',
            id: 'movies',
            name: 'Movies',
        },
        {
            type: 'tv',
            id: 'cable',
            name: 'Cable',
        },

    ],

    // prefix of item IDs (ie: "tt0032138")
    "idPrefixes": [ "atv" ],
};

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // accept self-signed certs

addon = new addonSdk(manifest);

// prepare data
var streams = {featured: [], shows: [], movies: [], cable: []};
axios.get(baseUrl)
.then((r) => {
    const root = html.parse(r.data);

    streams.featured = root.querySelectorAll('.stream-list-featured a.poster-link');
    streams.featured.forEach((value, index) => {
        //var poster = baseUrl+value.querySelector('img').attributes.src;
        streams.featured[index] = {id: 'atv:featured:'+index, name: value.attributes.title, genres: ['tv'], type: 'tv', page: baseUrl+'/'+value.attributes.href, poster: '', background: noPoster, videos: [{id: 0, title: 'title', thumbnail: noPoster, publishedAt: new Date(), streams: [{url: 'https://'}]}], description: 'description'};
    });

    streams.shows = root.querySelectorAll('#shows .box-content a');
    streams.shows.forEach((value, index) => {
        streams.shows[index] = {id: 'atv:shows:'+index, name: value.attributes.title, genres: ['tv'], type: 'tv', page: baseUrl+'/'+value.attributes.href, poster: '', background: noPoster, videos: [{id: 0, title: 'title', thumbnail: noPoster, publishedAt: new Date(), streams: [{url: 'https://'}]}], description: 'description'};
    });

    streams.movies = root.querySelectorAll('#movies .box-content a');
    streams.movies.forEach((value, index) => {
        streams.movies[index] = {id: 'atv:movies:'+index, name: value.attributes.title, genres: ['tv'], type: 'tv', page: baseUrl+'/'+value.attributes.href, poster: '', background: noPoster, videos: [{id: 0, title: 'title', thumbnail: noPoster, publishedAt: new Date(), streams: [{url: 'https://'}]}], description: 'description'};
    });

    streams.cable = root.querySelectorAll('#cable .box-content a');
    streams.cable.forEach((value, index) => {
        streams.cable[index] = {id: 'atv:cable:'+index, name: value.attributes.title, genres: ['tv'], type: 'tv', page: baseUrl+'/'+value.attributes.href, poster: '', background: noPoster, videos: [{id: 0, title: 'title', thumbnail: noPoster, publishedAt: new Date(), streams: [{url: 'https://'}]}], description: 'description'};
    });

    //console.log(streams);

    return streams;
})
.catch((e) => {
    console.log(e);
})

// Catalog
addon.defineCatalogHandler((args, cb) => {
    console.log('catalog', args);

    //console.log(streams.featured[0].poster); // poster not working (cors?), try to find on tmdb

    //console.log(streams.featured[12]);

    if(args.id == 'featured') {
        cb(null, {metas: streams.featured});
    } else if(args.id == 'shows') {
        cb(null, {metas: streams.shows});
    } else if(args.id == 'movies') {
        cb(null, {metas: streams.movies});
    } else if(args.id == 'cable') {
        cb(null, {metas: streams.cable});
    }    
});

// Meta
addon.defineMetaHandler((args, cb) => {
    console.log('meta', args);

    var id = args.id.split(':');

    if(id.length < 3) {
        cb(null, {meta: {}});
        return;
    }

    if(id[1] == 'featured') {
        return cb(null, {metas: streams.featured[id[2]]});
    } else if(id[1] == 'shows') {
        return cb(null, {metas: streams.shows[id[2]]});
    } else if(id[1] == 'movies') {
        cb(null, {metas: streams.movies[id[2]]});
    } else if(id[1] == 'cable') {
        return cb(null, {metas: streams.cable[id[2]]});
    }

    cb(null, {meta: {}});
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

        const root = html.parse(r.data, {script: true});

        var scripts = root.querySelectorAll('script');
        // scripts.forEach((value, index) => {
        //     console.log(index, value.text);
        // })

        var url;

        // initialize eval environment
        var code = `
        let url;
        var videojs = (x) => {
            return {src: (y) => {url = y.src;}, play: (z) => {return url}};
        };
        videojs.Hls = {xhr: {beforeRequest: function() {}}};
        var document = {getElementsByTagName: (tag) => {return [{volume: 1.0}]}};
        `

        // eval!
        console.log('eval:', url = eval(code+scripts[8].text));

        axios.get(url)
        .then((r) => {
            var data = r.data;
            
            data = data.replace(/#EXTINF/g,
            `#EXT-X-DISCONTINUITY
#EXTINF`);

            console.log(data)

            fs.writeFile("public/stream.m3u8", data, function(err) {
                if(err) {
                    return console.log(err);
                }

                console.log("The file was saved!");
            });

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

            //console.log(streamUrls);

        })
        .catch((e) => {
            console.log(e);
        })

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
