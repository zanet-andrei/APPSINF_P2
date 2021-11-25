let express = require('express'),
    consolidate = require('consolidate'),
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    bodyParser = require("body-parser"),
    https = require("https"),
    fs = require("fs"),
    session = require("express-session");
    levenshtein = require('js-levenshtein');

var app = express();

app.use(session({
    secret:"projet1",
    resave:false,
    saveUninitialized: true,
    cookie : {
        path: "/",
        httpOnly: true
    }
}));

app.engine("html", consolidate.hogan);
app.set("views", "static");
app.use(bodyParser.urlencoded({ extended: true }));

MongoClient.connect("mongodb://localhost:27017", (err, db) => {

    db_restaurants = db.db("restaurants")

    app.get("/", function(req, res, next) {
        res.redirect("html/index.html");
    });

    // Barre de recherche (selon la description)

    app.post("/html/search", function(req, res, next) {
        db_restaurants.collection("restaurants").find({}).toArray(function(err, result) {
            if (err) throw err;
            if (result[0] != null) {

                tableToReturn = "<tr><th>Restaurant</th><th>Adresse</th><th>Temps d'attente</th><th>Temps d'attente moyen</th></tr>";
                // Objet qui contient des array triés par distance entre la recherche et les éléments de la BDD
                let distance = new Object();
                for (let i = 0; i < result.length; i++) {
                    // Calculer la distance entre la recherche de l'utilisateur et chaque élément de la BDD
                    dist = levenshtein(result[i]["restaurant"], req.body.search);
                    if (distance[dist] == null) {
                        distance[dist] = []
                    }
                    arr = [] // Tableau qui contient les infos liées à l'élément traité
                    for (let x in result[i]) {
                        if (x != "_id") {
                            arr.push(result[i][x]);
                        }
                    }
                    distance[dist].push(arr);
                }
                keys = []; // Tableau des clés à trier par ordre croissant afin de trouver les résultats les plus proches
                for (let key in distance) {
                    keys.push(parseInt(key));
                }

                keys = keys.sort(function(a, b) { return a - b; }); // Trier par ordre croissant

                nbRes = 5; // Nombre de résultats maximum à renvoyer

                searchResults = [] // Tableau contenant les résultats les plus pertinents de la recherche

                while (nbRes > 0) {
                    if (keys[0] == null) { // S'il n'y a plus aucun élément à comparer
                        nbRes = 0;
                    } else if (distance[keys[0]][0] == null) { // Retire la clé en cours d'utilisation s'il n'y a plus d'élément
                                                               // avec le poids keys[0]
                        keys.splice(0, 1);
                    } else {
                        searchResults.push(distance[keys[0]].splice(0, 1)); // Retire le résultat de l'objet distance et le
                                                                            // rajoute au tableau de résultats
                        nbRes -= 1
                    }
                }
                for (let x in searchResults) { // Création tableau à renvoyer
                    tableToReturn += "<tr>"
                    for (let y in searchResults[x][0]) {
                        tableToReturn += "<td>" + searchResults[x][0][y] + "</td>"
                    }
                    tableToReturn += "</tr>"
                }


            } else { // Si la BDD est vide
                tableToReturn = "<p>Aucun résultat ne correspond à votre recherche</p>"
            }
            res.render("html/index.html", {table:tableToReturn});
        });
    });

    app.get("/html/index.html", function(req, res, next) {
        db_restaurants.collection("restaurants").find({}).sort({_id:-1}).toArray(function(err, result) {
            if (err) throw err;
            if (result[0] != null) {
                tableToReturn = "<tr><th>Restaurant</th><th>Adresse</th><th>Temps d'attente</th><th>Temps d'attente moyen</th></tr>";
                for (let i = 0; i < result.length; i++) {
                    tableToReturn += "<tr>";
                    for (let x in result[i]) {
                        if (x != "_id") {
                            tableToReturn += "<td>" + result[i][x] + "</td>";
                        }
                    }
                    tableToReturn += "</tr>";
                }
            } else {
                tableToReturn = "<p>Aucun élément ne correspond à votre recherche.</p>"
            }

            res.render("html/index.html", {table:tableToReturn});
        });
    });

    app.use(express.static("static"));
    https.createServer({
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        passphrase: 'projet'
    }, app).listen(8080);

});