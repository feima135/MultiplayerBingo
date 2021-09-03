// var Client = {};
// Client.socket = io.connect();

// ////////////////////////////////
// // client sending to server
// ///////////////////////////////

// Client.turnComplete = function(){
//     console.log("turnComplete from client");

//     Client.socket.emit('turnComplete');
//     //this.scene.get('HomePage').turnCompleteUpdate();
// };


// Client.broadcastBingoQns = function()
// {
//     Client.socket.emit('newBingoQns');
// };


// ////////////////////////////////
// // client receive from server
// ///////////////////////////////

// Client.socket.on('allClientsUpdateNewBingoQns', function(data){
//     console.log("client got this msg + updateNewBingoQns" + data);
// });
