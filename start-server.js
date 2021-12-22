const { delay } = require('bluebird');
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
    tf_idf = require("tf-idf-search");
    crypto = require("crypto-js");

var app = express();

app.use(session({
    secret:"projet2",
    resave:false,
    saveUninitialized: true,
    cookie : {
        path: "/",
        httpOnly: true
    }
}));



function verif_mdp(mot_de_passe){
	const mdp = mot_de_passe.split("");
    const majuscules = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
	const minuscule = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
	const special = ['.',"*","[","]","(",")","$","{","}","=","!","<",">","|",":","-","_","#"];
	const numbers = ["0","1", "2", "3", "4", "5", "6", "7", "8", "9"];
    let bool_maj = false;
    let bool_min = false;
    let bool_num = false;
    let bool_spe = false;
	for (let index = 0; index < mdp.length; index++) {
		if (majuscules.includes(mdp[index])){
			bool_maj = true;
		} else if ((minuscule.includes(mdp[index]))) {
			bool_min = true;
		} else if ((special.includes(mdp[index]))){
			bool_spe = true;
		} else if (numbers.includes(mdp[index])){
			bool_num = true;
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

    db_account = db.db("accounts"); 

    app.get("/", function(req, res, next) {
        res.redirect("html/index.html");
    });

    app.get("/html/connexion_compte.html", function(req, res, next) {
        if (req.session.username == null) {
            res.render("html/connexion_compte.html", {Deconnexion: "Connexion"});
        } else {
            req.session.destroy();
            res.redirect("index.html");
        }
    });

    //Redirect page ajout resto admin

    app.get("/html/ajout_resto.html", function(req, res, next) {
        if (req.session.username == "admin") {
            res.render("html/ajout_resto.html",{Connexion : "Hello Boss",error:"",Admin : "", Deconnexion : "Deconnexion"});
        } else {
            res.render("html/connexion_compte.html",{Connexion : "Connexion", error:"Vous n'êtes pas administrateur",Admin:""});
        }
    });

    //ajout des elements a la db 

	app.post("/html/ajoutResto", function(req, res, next) {
		if (req.session.username == "admin") {
			desc = req.body.description;
			nameresto = req.body.nameResto;
			imagelink = req.body.imageLink;
            imagelink2 = req.body.imageLink2;
            imagelink3 = req.body.imageLink3;
            imagelink4 = req.body.imageLink4;
			address = req.body.nameAddress;
            address_link = req.body.address_link;
			if (address == "" || desc == "" || nameresto == "" || imagelink == ""|| address_link == ""|| imagelink2 == ""|| imagelink3 == ""|| imagelink4 == "") {
				res.render("html/ajout_resto.html", {error:"Veuillez remplir toutes les cases"});
			} else {
				db_restaurants.collection("restaurants").findOne({"name": nameresto}, (err, doc) => {
					if (err) throw err;
					if (doc == null) {
						db_restaurants.collection("restaurants").findOne({"address": address}, (err, doc) => {
							if (err) throw err;
							if (doc == null) {
								db_restaurants.collection("restaurants").insertOne({"imagelink": imagelink, "name": nameresto, "address": address, "desc": desc, "address_link" :address_link,"imagelink2": imagelink2,"imagelink3": imagelink3,"imagelink4": imagelink4});
								res.render("html/ajout_resto.html", {error:"Restaurant ajouté"});
							} else {
								res.render("html/ajout_resto.html", {error:"Cette adresse existe déjà dans la base de données"});
							}
						});
					} else {
						res.render("html/ajout_resto.html", {error:"Un restaurant existe déjà avec ce nom dans la base de données"});
					}
				});
			}
		}
	});

    //Redirection page création compte
    app.get("/html/creation_compte.html", function(req, res, next) {
        if (req.session.username == null) {
            res.render("html/creation_compte.html",{Deconnexion : "Connexion",error :""});
        }else {
            res.redirect("index.html")
        }
    });  

    //Redirection contact admin
    app.get("/html/Contact_admin.html", function(req, res, next) {
        if (req.session.username == null) {
            res.render("html/Contact_admin.html",{Connexion : "",error :"", Deconnexion : "Connexion"});
        }else if (req.session.username == "admin") {
            res.render("html/Contact_admin.html",{Connexion : "Hello Boss" ,error:"",Admin:"Ajouter un restaurant", Deconnexion : "Deconnexion"});
        } else {
            res.render("html/Contact_admin.html",{Connexion : "Bienvenue " + req.session.username ,error:"",Deconnexion : "Deconnexion"});
        }
    });

    // Barre de recherche (selon la description)

     app.get("/html/search", function(req, res, next) {
        //barre nav alex
        var error_pseudo = ""
        var admin_ = ""
        
        
        if (req.session.username == null) {
            error_pseudo = "";
            dec = "Connexion";
        }else if (req.session.username == "admin") {
            error_pseudo = "Hello Boss";
            admin_ = "Ajouter un restaurant";
            dec = "Deconnexion";
        } else {
            error_pseudo = "Bienvenue " + req.session.username;
            dec = "Deconnexion";
        }
        //fin barre nav
        db_restaurants.collection("restaurants").find({}).toArray(function(err, result) {
            db_com.collection("commentaire").find({}).sort({like:-1}).toArray(function(err, result2) {
            if (err) throw err;
            if (result[0] != null) {
				
				let restaurantNames = []
				search = req.query.search
				
				tfidf = new tf_idf()
				
				for (let i = 0; i < result.length; i++) {
					restaurantNames.push(result[i]["name"]);
				}
				
				var corpus = tfidf.createCorpusFromStringArray(restaurantNames);
				
				var searchResults = tfidf.rankDocumentsByQuery(search)
				tableToReturn = "<tr><th>Restaurant</th><th>Nom</th><th>Adresse</th><th>Description</th><th>Top - Commentaire</th><th>Top - Temps d'attente</th><th>Temps d'attente moyen</th></tr>";
				
                count = 0;

                if (result.length > 9) { // nombre arbitraire de resultats maximum, ici 10
                    maxResults = 10;
                } else {
                    maxResults = result.length;
                }

				while (maxResults > 0) {

					for (let x in searchResults) {
						maxResults -= 1
						if (maxResults < 0) {
							break;
						} else {
							tableToReturn += "<tr><form action='/html/restaurants.html' method='get'>";
							index = searchResults[x]["index"]
                            console.log(result2)
                            for (let y in result[index]) {
                                if (y != "_id"  && y != "address_link" && y != "imagelink2" && y != "imagelink3" && y != "imagelink4") {
                                    if (count < 1) {
                                        count = 1;
                                        tableToReturn += "<td><button type='submit' name='restaurantname' value='" + result[index]["name"] + "' class='ImageButton'><img src='" + result[index][y] + "' class='btnImage'></td>";
                                    } else {
                                        tableToReturn += "<td>" + result[index][y] + "</td>";
                                    }
                                }
                            }

                            tableToReturn += "<td>" + result2[index]["com"] + " ( " + result2[index]["like"] + " likes )" + "</td><td>" + result2[index]["time"] + " minutes</td>"
                            tableToReturn += "</form></tr>"
                            count = 0;
                        };  
                    }
				}      
            } else { // Si la BDD est vide
                tableToReturn = "<p>Aucun résultat ne correspond à votre recherche</p>"
            }
            res.render("html/index.html", {table:tableToReturn, Connexion : error_pseudo , Admin : admin_, Deconnexion : dec});
        });
        });
    });

    //création de compte (Alex)

    app.post("/html/create", function(req,res,next) {
        psw = req.body.password_new;
        if(req.body.username_new == "" || req.body.email_new == "" || req.body.password_new == "" || req.body.confirm_password == ""){
            res.render("html/creation_compte.html",{error: "Veuillez remplir toutes les cases !"});
        } else{
            db_account.collection("accounts").findOne({"username" : req.body.username_new}, (err,doc) => {
                if (err) throw err;
                if (doc != null){
                    res.render("html/creation_compte.html", {error:"Ce nom d'utilisateur est déjà pris"});
                }else if (req.body.password_new.length < 8){
                    res.render("html/creation_compte.html", {error: "Le mot de passe doit contenir minimum 8 caractères"})
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

                    for (let i = 0; i < error.length; i++) {
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
                    res.render("html/creation_compte.html", {error: errorMessage});
                }else if (req.body.password_new != req.body.confirm_password){
                    res.render("html/creation_compte.html", {error:"Les deux mots de passes ne correspondent pas"});
                }else {
                    db_account.collection("accounts").findOne({"email" : req.body.email_new}, (err,doc) => {
                        if (err) throw err;
                        if (doc != null){
                            res.render("html/creation_compte.html", {error:"Cette adresse e-mail est déjà prise"});
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
            })
        }
    });


    // Connexion à un compte (Alex)


    app.post("/html/connect",function(req,res,next){
        if (req.body.username == "" || req.body.password == ""){
            res.render("html/connexion_compte.html", {error: "Veuillez remplir toutes les cases!"});
        } else {      
            var hashed = crypto.MD5(req.body.password);
            var hash_pwd = hashed.toString();
            
            db_account.collection("accounts").findOne({"username" : req.body.username,"password" : hash_pwd}, (err,doc) => {
                if (err) throw err;
                if (doc == null) {
                    res.render("html/connexion_compte.html", {error : "Nom d'utilisateur ou mot de passe incorrect"});
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
        //barre nav alex
        var error_pseudo = ""
        var admin_ = ""
        
        
        if (req.session.username == null) {
            error_pseudo = "";
            dec = "Connexion";
        }else if (req.session.username == "admin") {
            error_pseudo = "Hello Boss";
            admin_ = "Ajouter un restaurant";
            dec = "Deconnexion";
        } else {
            error_pseudo = "Bienvenue " + req.session.username;
            dec = "Deconnexion";
        }
        //fin barre nav
        db_restaurants.collection("restaurants").find({}).sort({_id:-1}).toArray(function(err, result) {
            if (err) throw err;
            if (result[0] != null) {
				count = 0
                tableToReturn = "<tr><th>Restaurant</th><th>Nom</th><th>Adresse</th><th>Description</th><th>Commentaire & temps d'attente</th><th>Temps d'attente moyen</th></tr>";
                for (let i = 0; i < result.length; i++) {
                    tableToReturn += "<tr><form action='/html/restaurants.html' method='get'>";
                    for (let x in result[i]) {
                        if (x != "_id"  && x != "address_link" && x != "imagelink2" && x != "imagelink3" && x != "imagelink4") {
							if (count < 1) {
								tableToReturn += "<td><button type='submit' name='restaurantname' value='" + result[i]["name"] + "' class='ImageButton'><img src='" + result[i][x] + "' class='btnImage'></td>";
								count = 1;
							} else {
								tableToReturn += "<td>" + result[i][x] + "</td>";
							}
                        }
                    }
					tableToReturn += "</form></tr>"
					count = 0;
                }
            } else {
                tableToReturn = "<p>Aucun élément ne correspond à votre recherche.</p>"
            }

            res.render("html/index.html", {table:tableToReturn, Connexion : error_pseudo ,Admin : admin_, Deconnexion : dec});
    
        });
    });


    //Base de données
    db_com = db.db("commentaire");

    //GET de la page restaurants.html
	app.get("/html/restaurants.html", function(req, res, next) {

        //Initialisation VAR session
        if (req.session.username == null) {
            error_pseudo = "";
            admin_ = "";
            dec = "Connexion";
        }else if (req.session.username == "admin") {
            error_pseudo = "Hello Boss";
            admin_ = "Ajouter un restaurant";
            dec = "Deconnexion";
        } else {
            error_pseudo = "Bienvenue " + req.session.username;
            admin_ = "";
            dec = "Deconnexion";
        }   

        nameEnd = ""
        descEnd = ""
        imageEnd =""
        //Initialisation info restaurant

        if (req.query.restaurantname != null){    
            db_restaurants.collection("restaurants").findOne({"name" : req.query.restaurantname}, (err,doc) => {
                if (err) throw err;
                nameEnd = doc["name"]
                descEnd = doc["desc"]
                //imageEnd = '<img id="prog" src="'+doc["imagelink"]+'" </img>'
                imageEnd = ""
                if (doc["imagelink"] != "/"){
                    imageEnd +=  '<img id="prog" src="'+doc["imagelink"]+'"</img>'
                }else{
                    imageEnd +=  '<img id="prog" src="../no.png"</img>'
                }
                if (doc["imagelink2"] != "/"){
                    imageEnd +=  '<span id="prog2" type="hidden" src="'+doc["imagelink2"]+'"</span>'
                }else{
                    imageEnd +=  '<span id="prog2" type="hidden" src="../no.png"</span>'
                }
                if (doc["imagelink3"] != "/"){
                    imageEnd +=  '<span id="prog3" type="hidden" src="'+doc["imagelink3"]+'"</span>'
                }else{
                    imageEnd +=  '<span id="prog3" type="hidden" src="../no.png"</span>'
                }
                if (doc["imagelink4"] != "/"){
                    imageEnd +=  '<span id="prog4" type="hidden" src="'+doc["imagelink4"]+'"</span>'
                }else{
                    imageEnd +=  '<span id="prog4" type="hidden" src="../no.png"</span>'
                }
                imageEnd +=  '<span id="temp" type="hidden" src="'+doc["imagelink"]+'"</span>'
               
                
            })
        }
        
            //commentaires affichage et retour error
            er =""
            db_com.collection("commentaire").find({resto: req.query.restaurantname}).sort({"like": -1}).toArray(function(err, result) {
                if (err) throw err;
                tableToReturn = ""
                if (result[0] != null) {
                    tableToReturn = "<tr><th>Posté par</th><th>Commentaire</th><th>Likes</th><th>Temps attendu</th></tr><br>"
                    for (let i = 0; i < result.length; i++) {
                        tableToReturn += "<tr><td>"+ result[i]["pseudo"] + "</td><td class='colComm'>" + result[i]["com"] + "</td><td><a href='/html/supp?number=" + i + "&text=" + result[i]["com"] + "'> Like " +result[i]["like"] + "</a></td><td>"+ result[i]["time"] + " minutes</td></tr>"
                        //allcom += '<p class="allCom">' +'<span> Posté par: '+result[i]["pseudo"]+' </span> '+ result[i]["com"] + '<a href=/html/supp?number='+i +'&text='+result[i]["com"]+'> Like '+" " +result[i]["like"] +'</a></p>'
                    }
                } else{
                        tableToReturn = "<p>Espace commentaire vide.</p>"
                }
                if (req.query.errorCom == 1){
                    er = "Vous devez être connecté pour poster un commentaire ! "
                }else if (req.query.errorCom == 2){
                    er = "Combien de temps avez-vous attendus pour être servis ?"
                }else if (req.query.errorCom == 3){
                    er = "Commentaire requis"
                }
                res.render("html/restaurants.html", {image: imageEnd ,errorCom :er ,name : nameEnd, table: tableToReturn ,compte: "Se connecter" ,description: descEnd,Connexion : error_pseudo, Admin : admin_, Deconnexion : dec})
            });
        })
    
	//post d'un commentaire
    app.post("/html/restaurants.html", function(req, res, next) {
		
        if (req.session.username != null){
            if (req.body.com == ""){
                res.redirect("/html/restaurants.html?restaurantname="+nameEnd+"&errorCom=3")
            }else{
                if (req.body.temps != -1){
                    db_com.collection("commentaire").insertOne({"com": req.body.com , "like":0 , "pseudo" : req.session.username, "resto" : nameEnd, "likedBy": [], "time" : req.body.temps});
                }else{
                    res.redirect("restaurants.html?errorCom=2&restaurantname="+nameEnd)
                }
                res.redirect("/html/restaurants.html?restaurantname="+nameEnd)
            }
        }else{
            res.redirect("restaurants.html?errorCom=1&restaurantname="+nameEnd)
        }
	});

    //Like et dislike des commentaires
    app.get("/html/supp", function(req, res, next){
        if ( req.session.username != null){
            db_com.collection("commentaire").find({resto: nameEnd}).toArray(function(err, result) {
                if (err) throw err;
                index = result[req.query.number]["likedBy"].indexOf(req.session.username)
                console.log(index)
                console.log(result)
                console.log(req.query.number)
                console.log(result[req.query.number]["likedBy"])
                if (index === -1){
                    console.log("if")
                    like = result[req.query.number]["like"] + 1
                    result[req.query.number]["likedBy"].push(req.session.username)
                    likedby = result[req.query.number]["likedBy"]
                    db_com.collection("commentaire").update({"com": req.query.text}, {$set: {"like": like}})
                    db_com.collection("commentaire").update({"com": req.query.text}, {$set: {"likedBy": likedby}})
                    res.redirect("/html/restaurants.html?restaurantname="+nameEnd)
                }else{
                    console.log("else")
                    like = result[req.query.number]["like"] - 1
                    result[req.query.number]["likedBy"].pop(req.session.username);
                    likedby = result[req.query.number]["likedBy"]
                    db_com.collection("commentaire").update({"com": req.query.text}, {$set: {"like": like}})
                    db_com.collection("commentaire").update({"com": req.query.text}, {$set: {"likedBy": likedby}})
                    res.redirect("/html/restaurants.html?restaurantname="+nameEnd)
                }
            });
        }else{
            res.redirect("/html/restaurants.html?restaurantname="+nameEnd)
        }
    })

    //map resto 
    app.get("/html/map.html", function(req,res,next){
        //barre nav alex
        var error_pseudo = ""
        var admin_ = ""
        

        
        if (req.session.username == null) {
            error_pseudo = "";
            dec = "Connexion";
        }else if (req.session.username == "admin") {
            error_pseudo = "Hello Boss";
            admin_ = "Ajouter un restaurant";
            dec = "Deconnexion";
        } else {
            error_pseudo = "Bienvenue " + req.session.username;
            dec = "Deconnexion";
        }
        //fin barre nav
        db_restaurants.collection("restaurants").findOne({"name":nameEnd}, (err, result) => {
            if (err) throw err;
            if (result == null){
                res.redirect("/html/index.html")
            } else {
                add = "<div style='display:flex;justify-content:center;'><p id='mapNameResto'> Carte de " + result["name"] + "</p><br>" + result["address_link"] + "</div>";
                res.render("html/map.html" , {"map": add, Connexion : error_pseudo ,Admin : admin_, Deconnexion : dec});
            }  
            
        })
    });



    app.use(express.static("static"));
    https.createServer({
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        passphrase: 'projet'
    }, app).listen(8080);

});