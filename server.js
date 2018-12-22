const html = require('node-html-parser');
const axios = require('axios');
const striptags = require('striptags'); // not perfect, doesn't strip html entities. try 'he' ?
const addonSdk = require('stremio-addon-sdk');
const safeEval = require('safe-eval');

/*
TODO:
- streams, stream id as index.
- replace eval with safe-eval or secure-eval https://www.npmjs.com/package/safe-eval
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
    "idPrefixes": [ "arc" ],
};

addon = new addonSdk(manifest);

// prepare data
var streams = {featured: [], shows: [], movies: [], cable: []};
axios.get(baseUrl)
.then((r) => {
    const root = html.parse(r.data);

    streams.featured = root.querySelectorAll('.stream-list-featured a.poster-link');
    streams.featured.forEach((value, index) => {
        //var poster = baseUrl+value.querySelector('img').attributes.src;
        streams.featured[index] = {id: 'arc:'+index, name: value.attributes.title, genres: ['tv'], type: 'featured', page: baseUrl+'/'+value.attributes.href, /*poster: poster, background: poster, overview: 'overview',*/ description: 'description'};
    });

    streams.shows = root.querySelectorAll('#shows .box-content a');
    streams.shows.forEach((value, index) => {
        streams.shows[index] = {id: 'arc:'+index, name: value.attributes.title, genres: ['tv'], type: 'shows', page: baseUrl+'/'+value.attributes.href, /*poster: noPoster, background: noPoster, overview: 'overview',*/ description: 'description'};
    });

    streams.movies = root.querySelectorAll('#movies .box-content a');
    streams.movies.forEach((value, index) => {
        streams.movies[index] = {id: 'arc:'+index, name: value.attributes.title, genres: ['tv'], type: 'movies', page: baseUrl+'/'+value.attributes.href, /*poster: noPoster, background: noPoster, overview: 'overview',*/ description: 'description'};
    });

    streams.cable = root.querySelectorAll('#cable .box-content a');
    streams.cable.forEach((value, index) => {
        streams.cable[index] = {id: 'arc:'+index, name: value.attributes.title, genres: ['tv'], type: 'cable', page: baseUrl+'/'+value.attributes.href, /*poster: noPoster, background: noPoster, overview: 'overview',*/ description: 'description'};
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
})

// Meta
addon.defineMetaHandler((args, cb) => {
    console.log('meta', args);


    // if(args.id == 'featured') {
    //     cb(null, {metas: streams.featured});
    // } else if(args.id == 'shows') {
    //     cb(null, {metas: streams.shows});
    // } else if(args.id == 'movies') {
    //     cb(null, {metas: streams.movies});
    // } else if(args.id == 'cable') {
    //     cb(null, {metas: streams.cable});
    // }

    cb(null, {meta: {}});

    // var dataset = {
    //     id: args.id,
    //     name: cache[args.id].name,
    //     overview: cache[args.id].overview,
    //     description: cache[args.id].overview,
    //     genres: cache[args.id].genres,
    //     type: 'series',
    //     poster: cache[args.id].poster,
    //     background: cache[args.id].background,
    //     videos: videos,
    //     isPeered: true
    // };

    // return dataset;
});

// Streaming
addon.defineStreamHandler((args, cb) => {
    console.log('stream', args);

    console.log('getting '+streams.featured[0].page);
    axios.get(streams.featured[0].page)
    .then((r) => {

        const root = html.parse(r.data, {script: true});

        var scripts = root.querySelectorAll('script');
        // scripts.forEach((value, index) => {
        //     console.log(index, value.text);
        // })

        var url;

        // initialize eval environment
        var code = `
        var videojs = (x) => {
            return {src: (y) => {return y.src;}, play: (z) => {return 'z'}};
        }
        videojs.Hls = {xhr: {beforeRequest: function() {}}};
        var document = {getElementsByTagName: (tag) => {return [{volume: 1.0}]}};`

        // eval!
        console.log('eval:', safeEval(code+scripts[8].text));

        var streams = [
            {
                name: 'ArconaiTV',
                title: 'url',
                url: url,
                tag: ['tag'],
                //isFree: 1
            }
        ];

        cb(null, {streams: streams});

        console.log(streams);

    })
    .catch((e) => {
        console.log(e);
    })
})

if (module.parent) {
    module.exports = addon
} else {
    //addon.publishToCentral('https://tv.ers.pw/manifest.json')

    addon.runHTTPWithOptions({ port: 7001 });
}
