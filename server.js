var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

app.use('/css',express.static(__dirname + '/css'));
app.use('/js',express.static(__dirname + '/js'));
app.use('/assets',express.static(__dirname + '/assets'));

app.get('/',function(req,res){
    res.sendFile(__dirname+'/index.html');
});

server.lastPlayerID = 0;
server.currQns = 0; 
server.answers = [];

server.listen(process.env.PORT || 8081,function(){
    console.log('Listening on '+server.address().port);
});

//////////////////////////
// connection with socket
/////////////////////////
io.on('connection', function (socket) {

    /**** A new player added  *****/ 
    socket.on('askNewPlayer', function () {

        socket.player = {
            id: server.lastPlayerID++,
            isGameMaster: false,
            madeSelection: false,
            validPlayer: true
        };

        if (server.currQns >= 1) {
            socket.disconnect();
            //socket.player.validPlayer = false;
        }

        console.log("New user " + server.lastPlayerID + " connected to server");

        //console.log(getAllPlayers());

        // tell myself
        socket.emit('NewPlayerJoinedServer', server.currQns, getAllPlayers());

        // tell gamemaster if set
        if (server.gameMasterSocket) {
            server.gameMasterSocket.emit('NewPlayerJoinedServer', server.currQns, getAllPlayers());
        }

        /**** Client drops  *****/ 
        socket.on('disconnect', function () {
            console.log("User " + socket.player.id + "disconnected from server");
            
            io.emit('OnClientDisconnected', getAllPlayers());

            // game master dropped
            if(socket.player.isGameMaster)
            {
                console.log("Game Master Disconnected");

                // reset values
                server.lastPlayerID = 0;
                server.currQns = 0; 
                server.answers = [];

                io.emit('GameMasterDisconnected');

                Object.keys(io.sockets.connected).forEach(function(socketID){
                    var targetSocket = io.sockets.connected[socketID];
                    targetSocket.disconnect(true);
                });
            }     
        });
    });
   
    /**** A client has registered as game master  *****/
    socket.on('RegisterAsGameMaster', function () {

        console.log("RegisterAsGameMaster");

        socket.player.isGameMaster = true;
        server.gameMasterSocket = socket;

        // game master setup, we can start the game now
        io.emit('GameMasterAssigned', getAllPlayers());
    });

    /**** Game Master generated a new bingo answer  *****/
    socket.on('NextBingoAnswerGenerated', function (rngBingoIndex) {

        ++server.currQns;

        server.answers.push(rngBingoIndex);
        console.log("Pushing answers" + rngBingoIndex);

        // reset flags
        Object.keys(io.sockets.connected).forEach(function (socketID) {
            var player = io.sockets.connected[socketID].player;
            if (player) {
                player.madeSelection = false;
            }
        });

        io.emit('OnNextBingoAnswerGenerated', server.currQns, rngBingoIndex, getAllPlayers());
    });

    /**** Client confirms bingo selection  *****/
    socket.on('playerConfirmBingoSelection', function () {

        socket.player.madeSelection = true;

        let allPlayers = getAllPlayers();
        //console.log(allPlayers);

        // tell game master about player making selections
        if(server.gameMasterSocket)
        {
            server.gameMasterSocket.emit('OnPlayerMadeBingoSelection', allPlayers, server.currQns);
        }
    });

    /**** All Players done selecting  *****/
    socket.on('AllPlayersDoneSelection', function () {

        let rngBingoIndex = server.answers[server.currQns - 1];

        console.log("AllPlayersDoneSelection " + rngBingoIndex);

        io.emit('RevealBingoAnswer', server.currQns, rngBingoIndex);
    });

    /**** someone bingoed  *****/
    socket.on('OnPlayerBingoComplete', function () {

      socket.player.validPlayer = false;
      
      // tell game master about someone bingoed
      if(server.gameMasterSocket)
      {
          server.gameMasterSocket.emit('OnGMNotifyBingoComplete', socket.player);
      }
    });
});

function doesGameMasterExist()
{
    console.log("doesGameMasterExist");

    Object.keys(io.sockets.connected).forEach(function(socketID){
        var player = io.sockets.connected[socketID].player;

        console.log(player);
        if(player.isGameMaster)
        {
            return true;
        }
    });

    return false;
}

function getAllPlayers(){
    var players = [];
    Object.keys(io.sockets.connected).forEach(function(socketID){
        var player = io.sockets.connected[socketID].player;
        if(player) players.push(player);
    });
    return players;
}