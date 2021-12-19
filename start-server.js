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
	const special = ['.',"*","[","]","(",")","$","{","}","=","!","<",">","|",":","-","_","#"];
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

    //Redirection page connexion compte
    app.get("/html/test_page_co.html", function(req, res, next) {
        req.session.destroy();
        res.render("html/test_page_co.html");
        //if (req.session.username == null) {
        //    res.render("html/test_page_co.html",{Connexion : "Connexion",error :""});
        //}else if (req.session.username == "admin") {
        //    res.render("html/test_page_co.html",{Connexion : "Bienvenue Boss" ,error:"",Admin:"Ajouter un restaurant", Deconnexion : "Deconnexion"});
        //}else if (req.session.username != null){
        //    req.session.destroy();
        //    res.render("html/test_page_co.html")
        //}else {
        //    res.render("html/test_page_co.html",{Connexion : "Bienvenue " + req.session.username ,error:""});
        //}
    });

    //Redirect page ajout resto admin

    app.get("/html/ajout_resto.html", function(req, res, next) {
        if (req.session.username == "admin") {
            res.render("html/ajout_resto.html",{Connexion : "Hello Boss",error:"",Admin : "", Deconnexion : "Deconnexion"});
        } else {
            res.render("html/test_page_co.html",{Connexion : "Connexion", error:"Vous n'êtes pas administrateur",Admin:""});
        }
    });

    //ajout des elements a la db 

	app.post("/html/ajoutResto", function(req, res, next) {
		if (req.session.username == "admin") {
			desc = req.body.description;
			nameresto = req.body.nameResto;
			imagelink = req.body.imageLink;
			address = req.body.nameAddress;
			if (address == "" || desc == "" || nameresto == "" || imagelink == "") {
				res.render("html/ajout_resto.html", {error:"Veuillez remplir toutes les cases"});
			} else {
				db_restaurants.collection("restaurants").findOne({"name": nameresto}, (err, doc) => {
					if (err) throw err;
					if (doc == null) {
						db_restaurants.collection("restaurants").findOne({"address": address}, (err, doc) => {
							if (err) throw err;
							if (doc == null) {
								db_restaurants.collection("restaurants").insertOne({"imagelink": imagelink, "name": nameresto, "address": address, "desc": desc});
								res.render("html/ajout_resto.html", {error:"Restaurant ajouté"});
							} else {
								res.render("html/ajout_resto.html", {error:"Cette addresse existe déjà dans la base de données"});
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
    app.get("/html/test_page_crea_compte.html", function(req, res, next) {
        if (req.session.username == null) {
            res.render("html/test_page_crea_compte.html",{Connexion : "Connexion",error :""});
        }else {
            res.render("html/test_page_crea_compte.html",{Connexion : "Bienvenue " + req.session.username ,error:"",Admin :""});
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
        db_restaurants.collection("restaurants").find({}).toArray(function(err, result) {
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
				tableToReturn = "<tr><th>Restaurant</th><th>Nom</th><th>Adresse</th><th>Commentaire & temps d'attente</th><th>Temps d'attente moyen</th></tr>";
				count = 0;

				maxResults = 3 // nombre arbitraire de resultats maximum
				
				while (maxResults > 0) {
					for (let x in searchResults) {
						maxResults -= 1
						if (maxResults < 0) {
							break;
						} else {
							tableToReturn += "<tr><form action='/html/restaurants.html' method='get'>";
							index = searchResults[x]["index"]
							for (let y in result[index]) {
								if (y != "_id") {
									if (count < 1) {
										count = 1;
										tableToReturn += "<td><button type='submit' name='restaurantname' value='" + result[index]["name"] + "' class='ImageButton'><img src='" + result[index][y] + "' class='btnImage'></td>";
									} else {
										tableToReturn += "<td><input type='submit' name='restaurantname' class='tablelinks' value='" + result[index][y] + "'></td>";
									}
									
								}
							}
							tableToReturn += "</form></tr>"
							count = 0;
						}	
					}
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
                        if (x != "_id") {
							if (count < 1) {
								tableToReturn += "<td><button type='submit' name='restaurantname' value='" + result[i]["name"] + "' class='ImageButton'><img src='" + result[i][x] + "' class='btnImage'></td>";
								count = 1;
							} else {
								tableToReturn += "<td><input type='submit' name='restaurantname' class='tablelinks' value='" + result[i][x] + "'></td>";
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


    //page resto et commentaire 
    db_com = db.db("commentaire");

	// Redirection des pages et affichage du nom d'utilisateur


	app.get("/html/restaurants.html", function(req, res, next) {

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
        //info de la page
        db_restaurants.collection("restaurants").find({}).sort({_id:-1}).toArray(function(err, result) {
			for (let i = 0; i < result.length; i++) {
                if (req.query.restaurantname == result[i]["name"]){
                    nameEnd = result[i]["name"]
                    descEnd = result[i]["desc"]
                }
            }
        })

        //commentaires
        er =""
		db_com.collection("commentaire").find({}).sort({_id:-1}).toArray(function(err, result) {
			if (err) throw err;
			if (result[0] != null) {
                allcom = ""
                if (result.length == 1){
                    allcom = allcom += '<p class="allCom">' +'<span>'+result[0]["pseudo"]+' </span> '+ result[0]["com"] + '<a href=/html/supp?number='+0 +'&text='+result[0]["com"]+'> Like '+" " +result[0]["like"] +'</a></p>'
                }else{
                    for (let i = 0; i < result.length; i++) {
                        allcom += '<p class="allCom">' +'<span>'+result[i]["pseudo"]+' </span> '+ result[i]["com"] + '<a href=/html/supp?number='+i +'&text='+result[i]["com"]+'> Like '+" " +result[i]["like"] +'</a></p>'
                    }
                }
			} else{
				allcom = "<p>Esapce commentaire vide.</p>"
			}
            if (req.query.errorCom == 1){
                er = "Vous devez être connecté pour poster un commentaire ! "
            }

            res.render("html/restaurants.html", {errorCom :er ,name : nameEnd, test: allcom ,compte: "Se connecter" ,description: descEnd,Connexion : error_pseudo, Admin : admin_, Deconnexion : dec})

		});
	});
    
	
    app.post("/html/restaurants.html", function(req, res, next) {
		
        if (req.session.username == null) {
            error_pseudo = "Connexion";
            admin_ = "";
            dec = "";
        }else if (req.session.username == "admin") {
            error_pseudo = "Hello Boss";
            admin_ = "Ajouter un restaurant";
            dec = "Deconnexion";
        } else {
            error_pseudo = "Bienvenue " + req.session.username;
            admin_ = ""
            dec = "Deconnexion";
        }
        if (req.session.username != null){
            if (req.body.com == "" || req.body.com.length < 1 ){
                res.redirect("/html/restaurants.html")
            }else{
                db_restaurants.collection("restaurants").insertOne({"time" : req.body.time})
                db_com.collection("commentaire").insertOne({"com": req.body.com , like:0 , pseudo : req.session.username});
                res.redirect("/html/restaurants.html")
            }
        }else{
            res.redirect("restaurants.html?errorCom=1")
           //res.render("html/restaurants.html", { name : nameResto , errorCom : "Vous devez être connecté pour poster un commentaire ! " , name : req.query.restaurantname, description: "desc",Connexion : error_pseudo, Admin : admin_, Deconnexion : dec})
        }
	});

    app.get("/html/supp", function(req, res, next){
        if (db_account.collection("accounts"))
        db_com.collection("commentaire").find({}).sort({_id:-1}).toArray(function(err, result) {
                a = 0
                a = result[req.query.number]["like"]
                a = a+1
                db_com.collection("commentaire").update({"com": req.query.text}, {$set: {like: a}})
                db_com.collection("commentaire").update({"com": req.query.text}, {$set: {status: true}})
            res.redirect("/html/restaurants.html")
        });
    })

    //map resto 
    app.get("/html/map.html"), function(req,res,next){
        res.render("html/map.html" , {map: "toutes la baslise iframe qui se trouve dans la bd"})
    }



    app.use(express.static("static"));
    https.createServer({
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        passphrase: 'projet'
    }, app).listen(8080);

});