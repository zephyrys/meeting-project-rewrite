#! /usr/bin/node
const vorpal    = require('vorpal')();
const neo4j          = require('neo4j-driver').v1;
const graphenedbURL  = ( process.env.GRAPHENEDB_BOLT_URL )      ?  process.env.GRAPHENEDB_BOLT_URL     : "bolt://localhost:7687";
const graphenedbUser = ( process.env.GRAPHENEDB_BOLT_USER )     ? process.env.GRAPHENEDB_BOLT_USER     : "neo4j";
const graphenedbPass = ( process.env.GRAPHENEDB_BOLT_PASSWORD ) ? process.env.GRAPHENEDB_BOLT_PASSWORD : "those scoreless irate scruffy zombie manhunts" ;

const driver  = neo4j.driver(graphenedbURL, neo4j.auth.basic(graphenedbUser, graphenedbPass))
const session = driver.session();
function findByEmail(email, cb) {
    console.log("[*] Searching database for email: " + email);
    session.run(
        'MATCH (user:User {email: $email}) RETURN user', { email: email }
    ).then(results => {
        session.close();
        if (!results.records[0]) {
            console.log("[*] User not found, returning null.");
            return cb(null, null);
        }
        console.log("[+] Found user, returning.");
        return cb(null, results.records[0].get('user'));
    });
}

function findById(id, cb) {
    console.log("[*] Searching database for ID: " + id);
    session.run(
        'MATCH (user) WHERE ID(user) = $identity RETURN user', { identity: neo4j.int(id) }
    ).then(results => {
        session.close();
        if (!results.records[0]) {
            return (null, null)
        }
        return cb(null, results.records[0].get('user'));
    });
}
function userAdd(email, password, role, firstName, lastName, cb) {
    findByEmail(email, function (err, user) {
        if (!user) {
            session.run(
                'CREATE (user:User {\
                 email: $email, \
                 hashed_password: $hashed_password, \
                 role: $role, \
                 firstName: $firstName, \
                 lastName: $lastName}) \
                 RETURN user',
                {
                    email: email,
                    hashed_password: generateHash(password),
                    role: role,
                    firstName: firstName,
                    lastName: lastName
                }
            ).then(results => {
                console.log("[+] Added User " + email + " to database.");
                session.close();
                user = results.records[0].get('user');
                cb(null, user);
            });
        }
        else {
            console.log("[-] User " + args.email + " exists in database. Enter a unique email.");
            cb("User Exists", null);
        }
    })
}
function userDel(userId, cb) {
    findById(id, function(err, user) {
        if (user) {
            session.run(
                'MATCH (user:User) \
                 WHERE ID(user) = $userId \
                 DETACH DELETE user',
                {userId: neo4j.int(userId)}
            ).then(results => {
                console.log("[+] Deleted user " + userId + " from database.");
                session.close();
                cb(null);
            });
        }
        else {
            cb("[-] User " + userId + " Doesn't Exist in database.")
        }
    });
}
function userDelByEmail(email, cb) {
    findByEmail(email, function(err, user) {
        if (user) {
            session.run(
                'MATCH (user:User) \
                 WHERE user.email = $email \
                 DETACH DELETE user',
                {email: email}
            ).then(results => {
                session.close();
                console.log("[+] Deleted user " + email + " from database.");
                cb(null)
            });
        }
        else {
            cb("[-] User " + userId + " Doesn't Exist in database.")
        }
    });
}

function getUsers(cb) {
    session.run(
        'MATCH (users:User) RETURN users'
    ).then(results => {
        session.close();
        console.log("[+] Retrieved user records from database");
        if (!results.records.length) { return cb(null, []); }
        users = [];
        results.records.forEach(res => {
            users.push(res.get('users'));
        })
        return cb(null, users);
    });
}

function getStudents(cb) {
    session.run(
        'MATCH (users:User) \
        WHERE users.role = "Student" \
        RETURN users'
    ).then(results => {
        session.close();
        console.log("[+] Retrieved student records from database");
        if (!results.records.length) { return cb(null, []); }
        users = [];
        results.records.forEach(res => {
            users.push(res.get('users'));
        })
        return cb(null, users);
    });
}

function getTeachers(cb) {
    session.run(
        'MATCH (users:User) \
             WHERE users.role = "Teacher" \
             RETURN users'
    ).then(results => {
        session.close();
        console.log("[+] Retrieved teacher records from database");
        if (!results.records.length) { return cb(null, []); }
        users = [];
        results.records.forEach(res => {
            users.push(res.get('users'));
        })
        return cb(null, users);
    });
}
function findActivityById(activityId, cb) {
    console.log("[*] Searching database for activityId: " + activityId + ".");
    session.run(
        'MATCH (activity:Activity) \
        WHERE ID(activity) = $activityId \
        RETURN activity',
        {activityId: neo4j.int(activityId)}).then(results => {
            session.close();
            ret = results.records[0].get('activity');
            if (!ret) { return cb("[-] Activity Not Found", null); }
            console.log('[+] Found activity "' + ret.properties.name + '".');
            return cb(null, ret);
        });
}

/**
   Arguments:
   - creatorId (int)
   The ID of the user who created the activity
   - activityName (string)
   The name of the activity
   - activityDescription (string)
   A description of the activity
   - requested attendees (int array)
   The emails of all requested attendees
   - cb (function)
   Callback Function
**/
function activityAdd(creatorId, activityName, activityDescription, requestedAttendees, cb) {
    findById(creatorId, function(err, user) {
        if (!user) { return cb("[-] User " + creatorId + " does not exist in database.")}
        session.run(
            'MATCH (creator:User) \
         WHERE ID(creator) = $creatorId \
         CREATE (creator)-[:CREATED]->(activity:Activity {\
           name: $activityName, \
           description: $activityDescription\
         }) \
         RETURN activity',
            {
                creatorId: neo4j.int(creatorId),
                activityName: activityName,
                activityDescription: activityDescription
            }
        ).then(results => {
            console.log("[+] Created Activity " + activityName);
            session.close();
            activityId = results.records[0].get('activity').identity.low;
            activityInvite(activityId, requestedAttendees, () => {
                return cb(null, results.records[0].get('activity'));
            })
        });
    });
}
function activityDel(activityId, cb) {
    console.log("[*] Checking that activity " + activityId + " exists in database.");
    findActivityById(activityId, function (err, activity) {
        if (!activity) { return cb(err) }
        session.run(
            'MATCH (activity:Activity) \
             WHERE ID(activity) = $activityId \
             DETACH DELETE activity',
            {
                activityId: neo4j.int(activityId)
            }
        ).then(results => {
            session.close();
            console.log("[+] Deleted activity " + activityId + " from database.");
            return cb(null);
        });
    });
}
function activityInvite(activityId, requestedAttendees, cb) {
    console.log("[*] Checking that activity " + activityId + " exists in database.");
    findActivityById(activityId, function (err, activity) {
        if (!activity) { return cb(err) }
        requestedAttendees.forEach(user_email => {
            session.run(
                'MATCH (activity:Activity),(student:User) \
                 WHERE ID(activity) = $activityId AND student.email = $email \
                 CREATE (student)-[rel:INVITED_TO]->(activity) \
                 SET rel.time = TIMESTAMP()',
                {
                    activityId: neo4j.int(activityId),
                    email: user_email
                }
            ).then(results => {
                session.close();
                console.log("[+] Invited user " + user_email + ".");
            });
        });
    });
    return cb();
}

function joinActivity(userId, activityId, cb) {
    var userPromise = new Promise((resolve, reject) => {
        findById((err, user) => {
            if (!user) { console.log("[-] Activity " + userId + "does not exist"); reject(false); }
            else { resolve(true); }
        });
    });

    var activityPromise = new Promise((resolve, reject) => {
        getActivityById((err, activity) => {
            if (!activity) { console.log("[-] Activity " + activityId + "does not exist"); reject(false); }
            else { resolve(true); }
        });
    });

    Promise.all([userPromise, activityPromise]).then(results => {
        if (results[0] && results[1]) { // If both user and activity exist:
            console.log("[+] Found both user and activity.");
            session.run(
                'MATCH (activity:Activity),(student:User) \
                 WHERE ID(activity) = $activityId AND ID(student) = $studentId \
                 CREATE (student)-[rel:JOINED]->(activity) \
                 SET rel.time = TIMESTAMP() \
                 RETURN activity, student'
            ).then(results => {
                session.close();
                console.log("[+] User " + results.records[0].get('student').properties.email + ' requested to join activity "' + results.records[0].get('student').properties.name + '"');
                return cb(null, results.records[0].get('activity'));
            });
        }
    });
}

function getActivities(cb) {
    session.run(
        'MATCH (activities:Activity) RETURN activities'
    ).then(results => {
        session.close();
        if (!results.records.length) { return cb(null, []); }
        activities = [];
        results.records.forEach(res => {
            activities.push(res.get('activities'));
        })
        return cb(null, activities);
    });
}
function messageAdd(senderId, recipientId, message, cb) {
    session.run(
        'MATCH (sender:User), (recipient:User) WHERE ID(sender) = $senderId AND ID(recipient) = $recipientId CREATE (sender)-[message:SENT]->(recipient) message.body = $message message.time = TIMESTAMP() RETURN message',
        {
            senderId: neo4j.int(senderId),
            recipientId: neo4j.int(recipientId),
            message: message
        }
    ).then(results => {
        session.close();
        return cb(null, results.records[0].get('message'))
    });
}
function messageDel(messageId, cb) {
    session.run(
        'MATCH ()-[r:SENT]->() WHERE ID(r) = messageId DELETE r',
        {
            messageId: neo4j.int(messageId)
        }
    ).then(results => {
        session.close();
        return cb(null);
    });
}

function getMessagesForUser(userId, cb) {
    session.run(
        'MATCH (recipient:User)<-[message:SENT]-(sender:User) WHERE ID(recipient) = $userId RETURN message, sender',
        {
            userId: neo4j.int(userId)
        }
    ).then(results => {
        session.close();
        var ret = [];
        if (!results.records.length) { return cb(null, []); }
        results.records.forEach((record) => {
            console.log('Pushing...');
            ret.push({
                sender: record.get('sender'),
                messages: record.get('message')
            });
        });
        return cb(null, ret);
    });
}
const passport = require('passport');
const bcrypt   = require('bcrypt-nodejs');

function generateHash (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(12), null);
}
function validPassword (password, hashed_password) {
    return bcrypt.compareSync(password, hashed_password);
};
var Strategy = require('passport-local').Strategy;


// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use('local-login', new Strategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true // allows us to pass back the entire request to the callback
},
    function(req, email, password, cb) {
        findByEmail(email, function(err, user) {
            if (err) { return cb(err); }
            if (!user) { return cb(null, false); }
            if (!validPassword(password, user.properties.hashed_password)) { return cb(null, false); }
            req.user = user;
            return cb(null, user);
        });
    }));

//Local-signup
passport.use('local-signup', new Strategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField : 'email',
    passwordField : 'password',
    passReqToCallback : true // allows us to pass back the entire request to the callback
},
    function(req, email, password, cb) {
        findByEmail(email, function (err, user) {
            if (!user) {
                userAdd(email, password, req.body.role_selector, req.body.firstName, req.body.lastName, function(err, new_user) {
                    cb(null, new_user);
                });
            }
            else {
                cb("User Exists", null);
            }
        })
    }));
passport.serializeUser(function(user, cb) {
    cb(null, user.identity.low);
});

passport.deserializeUser(function(id, cb) {
    findById(id, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});
const express = require('express');
const app = express();
var router = express.Router();
var express_session = require('express-session');

var flash = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

app.set('view engine', 'pug');


app.use(express_session({
    secret: 'undone cape discount magma outnumber repeater',
    resave: true,
    saveUninitialized: true
})); // session secret

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

//app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({
    extended: true
})); // get information from html forms
app.use(express.static('public'));

app.get('/', function (req, res) {
    res.render('index', {
        title:"CVU Study Form",
        user: req.user
    });
});
//Depending on how the webapp is implemented, we may not want random people creating an account.
//This code is useful, however, so I will use it.
app.get('/signup', function (req, res) {
    res.render('signup', { title: "Sign Up" });
});

app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/profile',
    failureRedirect : '/signup',
    failureFlash    : true
}));

app.get('/login', function (req, res) {
    res.render('login', { title: "Log in" });
});

// process the login form
app.post('/login', passport.authenticate('local-login', {
    successRedirect : '/profile', // redirect to the secure profile section
    failureRedirect : '/login', // redirect back to the login page if there is an error
    failureFlash : true // allow flash messages
}));
app.get('/profile', isLoggedIn, function (req, res) {
    const activityPromise = new Promise((resolve, reject) => {
        getActivities((err, activities) => {
            if (err) { reject(err); }
            else { resolve(activities); }
        });
    });
    const messagePromise = new Promise((resolve, reject) => {
        getMessagesForUser(req.user.identity.low, (err, messages) => {
            if (err) { reject(err); }
            else { resolve(messages); }
        });
    });
    const userPromise = new Promise((resolve, reject) => {
        getUsers((err, users) => {
            if (err) { reject(err); }
            else { resolve(users); }
        });
    });
    Promise.all([activityPromise, messagePromise, userPromise]).then((results) => {
        activities = results[0];
        messages = results[1];
        users = results[2];
        res.render('profile', {
            title: "Profile",
            user: req.user,
            activities: activities,
            messageRecords: messages,
            users: users
        });
    })
});
app.get('/create', isTeacher, function(req, res) {
    const activityPromise = new Promise((resolve, reject) => {
        getActivities((err, activities) => {
            if (err) { reject(err); }
            else { resolve(activities); }
        });
    });
    const messagePromise = new Promise((resolve, reject) => {
        getMessagesForUser(req.user.identity.low, (err, messages) => {
            if (err) { reject(err); }
            else { resolve(messages); }
        });
    });
    const userPromise = new Promise((resolve, reject) => {
        getUsers((err, users) => {
            if (err) { reject(err); }
            else { resolve(users); }
        });
    });
    Promise.all([activityPromise, messagePromise, userPromise]).then((results) => {
        activities = results[0];
        messages = results[1];
        users = results[2];
        res.render('create', {
            title: "Creating Activity",
            user: req.user,
            activities: activities,
            messageRecords: messages,
            users: users
        });
    })
});
app.post('/create', isTeacher, function(req, res) {
    activityAdd(req.user.identity.low,
                req.body.activityName,
                req.body.activityDescription,
                parseRequestedAttendees(req.body.requestedAttendees),
                (err, activity) => {
                    console.log("Created activity \"" + activity.properties.description + "\"");
                    res.redirect('/profile');
                });
});
app.get('*', function(req, res, next){
    res.status(404);

    // respond with html page
    if (req.accepts('html')) {
        res.render('404', { title:"Error 404, Page not found.", url: req.url });
        return;
    }
});
function isLoggedIn(req, res, cb) {

    if (req.isAuthenticated()) {
        return cb();
    }

    res.redirect('/');
}

function isTeacher(req, res, cb) {
    if (req.isAuthenticated() && ( req.user.properties.role === "Teacher" || req.user.properties.role == "Admin")) {
        return cb();
    }

    res.redirect('/');
}

function parseRequestedAttendees(requestedAttendees) {
    // Later, I'll want to parse groups as well, but for now it's just emails, and all I have to do is return a list of emails
    return requestedAttendees.split(", ").map(x => { return x.trim(); });
}
const port = (process.env.PORT) ? process.env.PORT : 3000;
app.listen(port);
vorpal
    .command('userAdd <email> <password> <role> <firstName> <lastName>', 'Adds User')
    .option('-v, --verbose', 'Prints user information as prettified JSON.')
    .action(function(args, callback) {
        userAdd(args.email, args.password, args.role, args.firstName, args.lastName, (err, user) => {
            if (args.options.verbose) {
                console.log(JSON.stringify(user, null, '\t'));
            }
            callback();
        });
    });


vorpal
    .command('userDel [email]', 'Deletes User')
    .option('-v, --verbose', 'Prints user information as prettified JSON.')
    .option('-e, --email <email>', 'Deletes user by email')
    .option('-i, --id <id>', 'Deletes user by ID')
    .action(function(args, callback) {
        if (!args.options.id && (args.options.email || args.email)) {
            console.log("[*] Deleting user by email.");
            var email = (args.options.email) ? args.options.email : args.email;
            userDelByEmail(email, (err) => {
                if (err) { console.log(err); callback(); }
                else {
                    callback();
                }
            });
        }
        else if (args.options.id) {
            console.log("[*] Deleting user by ID.");
            userDel(args.options.id, (err) => {
                if (err) { console.log(err); callback(); }
                else {
                    callback();
                }
            });
        }
        else {
            console.log("[-] Expected ID or Email");
            callback();
        }
    });

vorpal
    .command('getUsers')
    .action(function(args, callback) {
        console.log("[*] Getting JSON-formatted list of users.")
        getUsers((err, teachers) => {
            if (err) { console.log(err); return callback(); }
            else {
                users.forEach(user => {
                    console.log(JSON.stringify(user, null, 2));
                });
                callback();
            }
        })
    });

vorpal
    .command('getStudents')
    .action(function(args, callback) {
        console.log("[*] Getting JSON-formatted list of students.")
        getStudents((err, students) => {
            if (err) { console.log(err); return callback(); }
            else {
                students.forEach(user => {
                    console.log(JSON.stringify(user, null, 2));
                });
                callback();
            }
        })
    });

vorpal
    .command('getTeachers')
    .action(function(args, callback) {
        console.log("[*] Getting JSON-formatted list of teachers.")
        getTeachers((err, teachers) => {
            if (err) { console.log( '[-] ' + err); return callback(); }
            else {
                teachers.forEach(user => {
                    console.log(JSON.stringify(user, null, 2));
                });
                callback();
            }
        })
    });
vorpal
    .delimiter('myapp$')
    .show()
    .parse(process.argv);
