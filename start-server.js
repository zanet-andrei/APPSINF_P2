let express = require('express'),
    consolidate = require('consolidate'),
    MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    bodyParser = require("body-parser"),
    https = require("https"),
    fs = require("fs"),
    session = require("express-session");
const { truncate } = require('fs/promises');
const { addAbortSignal } = require('stream');
    levenshtein = require('js-levenshtein');
    //bcrytp = require("bcryptjs");
    crypto = require("crypto-js");

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

function verif_mdp(mot_de_passe){
	const mdp = mot_de_passe.split("");
    //console.log(mdp)
    const majuscules = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
	const minuscule = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
	const special = ['.',"*","[","]","(",")","$","{","}","=","!","<",">","|",":","-","_"];
	const numbers = ["0","1", "2", "3", "4", "5", "6", "7", "8", "9"];
    let bool_maj = false;
    let bool_min = false;
    let bool_num = false;
    let bool_spe = false;
	for (let index = 0; index < mdp.length; index++) {
		if (majuscules.includes(mdp[index])){
			bool_maj = true;
        	//console.log("Le mdp contient une majuscule" +" "+ mdp[index]);
		} else if ((minuscule.includes(mdp[index]))) {
			bool_min = true;
            //console.log("Le mdp contient une minuscule" +" "+ mdp[index]);
		} else if ((special.includes(mdp[index]))){
			bool_spe = true;
            //console.log("Le mdp contient des carac spéciaux" +" "+ mdp[index]);
		} else if (numbers.includes(mdp[index])){
			bool_num = true;
            //console.log("Le mdp contient des chiffres" +" "+ mdp[index]);
		}
	}	
    
    if(bool_maj == true && bool_min == true && bool_num == true && bool_spe == true){
        return true;
    } else {
    return [bool_maj, bool_min, bool_spe, bool_num];
    }
}

app.engine("html", consolidate.hogan);
app.set("views", "static");
app.use(bodyParser.urlencoded({ extended: true }));

MongoClient.connect("mongodb://localhost:27017", (err, db) => {

    db_restaurants = db.db("restaurants")

    db_account = db.db("accounts"); //Alex
    //db("accounts") sous la forme {"username" : pseudo, "password" : mdp, "email" : adresse email}


    app.get("/", function(req, res, next) {
        res.redirect("html/index.html");
    });

    app.get("/html/test_page_co.html", function(req, res, next) {
        res.render("html/test_page_co.html", {error : ""});
    });

    app.get("/html/test_page_crea_compte.html", function(req, res, next) {
        res.render("html/test_page_crea_compte.html",{error : ""});
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


    //création de compte (Alex)

    app.post("/html/create", function(req,res,next) {
        psw = req.body.password_new;
        if(req.body.username_new == "" || req.body.email_new == "" || req.body.password_new == "" || req.body.confirm_password == ""){
            res.render("html/test_page_crea_compte.html",{error: "Veuillez remplir toutes les cases !"});
        } else{
            db_account.collection("accounts").findOne({"username" : req.body.username_new}, (err,doc) => {
                if (err) throw err;
                if (doc != null){
                    res.render("html/test_page_crea_compte.html", {error:"Ce nom d'utilisateur est déjà pris"});
                }else if (req.body.password_new.length < 8){
                    res.render("html/test_page_crea_compte.html", {error: "Le mot de passe doit contenir minimum 8 caractères"})
                }else if (verif_mdp(psw) != true){
                    let result = verif_mdp(psw);
                    error = []
                    if (result[0] == false) {
                        error.push("une majuscule");
                    } if (result[1] == false) {
                        error.push("une minuscule");
                    }  if (result[2] == false) {
                        error.push("un caractère spécial");
                    }  if (result[3] == false) {
                        error.push("un chiffre");
                    }

                    errorMessage = "Votre mot de passe doit contenir au moins "
                    //console.log(error.length);

                    for (let i = 0; i < error.length; i++) {
                        //console.log(i);    
                        if (error.length >= 1) {
                            if ((error.length-1) == i) {
                                errorMessage += error[i];
                            } else if ((error.length-2) == i) {
                                errorMessage += error[i] + " et ";
                            } else {
                                errorMessage += error[i] + ", ";
                            }
                        } else {
                            errorMessage += error[i];
                        }
                    }
                    //console.log(error);
                    //console.log(result);
                    res.render("html/test_page_crea_compte.html", {error: errorMessage});
                }else if (req.body.password_new != req.body.confirm_password){
                    res.render("html/test_page_crea_compte.html", {error:"Les deux mots de passes ne correspondent pas"});
                }else {
                    db_account.collection("accounts").findOne({"email" : req.body.email_new}, (err,doc) => {
                        if (err) throw err;
                        if (doc != null){
                            res.render("html/test_page_crea_compte.html", {error:"Cette adresse e-mail est déjà prise"});
                        } else {
                            //hachage du mdp
                            console.log(req.body.password_new);
                            var hash = crypto.MD5(req.body.password_new);
                            hashed_pwd = hash.toString();
                            console.log(hash.toString());
                        
                            // fin du hachage
                            
                            db_account.collection("accounts").insertOne({"username" :req.body.username_new ,"password" : hashed_pwd , "email" : req.body.email_new });
                            req.session.username = req.body.username_new;
                            res.redirect("index.html");
                        }
                    })                    
                }

            }
            )
        }
    });

    // Connexion à un compte (Alex)

    app.post("/html/connect",function(req,res,next){
        if (req.body.username == "" || req.body.password == ""){
            res.render("html/test_page_co.html", {error: "Veuillez remplir toutes les cases!"});
        } else {      
            var hashed = crypto.MD5(req.body.password);
            var hash_pwd = hashed.toString();
            
            db_account.collection("accounts").findOne({"username" : req.body.username,"password" : hash_pwd}, (err,doc) => {
                if (err) throw err;
                if (doc == null) {
                    res.render("html/test_page_co.html", {error : "Nom d'utilisateur ou mot de passe incorect"});
                } else {
                    req.session.username = req.body.username;
                    res.redirect("index.html");
                }
            }
            )
        }
    }
    );

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
                tableToReturn = "<p>Aucun élément ne correspond à votre recherche.</p>";
            }

            res.render("html/index.html", {table:tableToReturn});
        });
    });


    //page resto et commentaire 
    db_com = db.db("commentaire");

	// Redirection des pages et affichage du nom d'utilisateur


	app.get("/html/restaurants.html", function(req, res, next) {

		db_com.collection("commentaire").find({}).sort({_id:-1}).toArray(function(err, result) {
			if (err) throw err;
			if (result[0] != null) {
				allcom = ""
				for (let i = 0; i < result.length; i++) {
					allcom += "<p>" + result[i]["com"] + '<a href=/html/supp?number='+result[i]["com"] +'> supp </a></p>'
				}
			} else{
				allcom = "<p>Esapce commentaire vide.</p>"
			}
			res.render("html/restaurants.html", {test: allcom , description:"Voici une description fixe (qui ne vient pas de la bd)"})
			
		});


	});
    
	
    app.post("/html/restaurants.html", function(req, res, next) {
        if (req.body.com == "" || req.body.com.length < 1 )
        res.redirect("/html/restaurants.html")
        db_com.collection("commentaire").insertOne({"com": req.body.com});
		db_com.collection("commentaire").find({}).sort({_id:-1}).toArray(function(err, result) {
			if (err) throw err;
			res.redirect("/html/restaurants.html")
		});


	});

    app.get("/html/supp", function(req, res, next){
        db_com.collection("commentaire").find({}).sort({_id:-1}).toArray(function(err, result) {
			if (err) throw err;
            if (result.length == 1 )
                db_com.collection("commentaire").remove({"com" : result[0]["com"]})
            else
                db_com.collection("commentaire").remove({"com" : req.query.number})
			    res.redirect("/html/restaurants.html")
		});
    })





    app.use(express.static("static"));
    https.createServer({
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        passphrase: 'projet'
    }, app).listen(8080);

});