//////////////////
// GLOBALS
/////////////////
g_MaxCells = 9;
g_MaxRow = 3;
g_MaxCol = 3;

// for players, main bingo board
g_Board = [];

// answer managed/stored by game master
g_Answer = [];

cellData = [-1, -1];

/**********************/
// main game
/**********************/
class MainGame extends Phaser.Scene {
  constructor() {
    super('MainGame')
  }

  /*********************/
  // Phaser preload
  /*********************/
  preload() {

    // load all the bingo input cells
    for (let i = 0; i < g_MaxCells; ++i) {
      let imageName = 'assets/BingoInput/' + i + '.png';
      this.load.image('Cell_' + i, imageName);
    }

    this.load.image("GameOverSplash", 'assets/GameOverSplash.png');
    this.load.image("GreenTick", 'assets/Tick.png');

    // show prereveal bingo icon
    this.load.image("QuestionMark", 'assets/QuestionMark.png');

    // used by game master for proceeding the game
    this.load.image("ProceedBtn", "assets/ProceedGameBtn.png");

    // used by players to lock in bingo selection
    this.load.image("ConfirmBtn", "assets/ConfirmBtn.png");

    // name form for registering game master
    this.load.html('nameform', 'assets/text/loginform.html');

    // load selection box image
    this.load.image("SelectionBox", 'assets/SelectionBox.png');

    this.ResetBingoAnswers();
    // load answer 
    //this.load.text('AnswerData', 'Answer.txt');

    //this.load.spritesheet('Fireworks', 'assets/Fireworks.png', { frameWidth: 64, frameHeight: 64 });
  }

  /*********************/
  // Phaser create
  /*********************/
  create() {
    var self = this; // cache

    // remind server that I am added
    this.socket = io.connect();
    this.socket.emit('askNewPlayer');

    this.createNameForm();

    this.CreateAnswerRevealCells();

    this.serverCallbackHandlers();

    this.createBoard();

    this.ToggleBoardVisibility(false);

    // players have confirm btns
    this.ConfirmBtn = this.add.image(config.width * 0.8, 100, "ConfirmBtn");
    this.ConfirmBtn.setInteractive();
    this.ConfirmBtn.on('pointerdown', this.buttonAnimEffect.bind(this, this.ConfirmBtn, function(){
      self.ConfirmBingoSelection();
      }));

    this.ConfirmBtn.setAlpha(0.5);
    this.ConfirmBtn.disableInteractive();

    this.GameOverSplash = this.add.image(config.width / 2, config.height / 2, "GameOverSplash");
    this.GameOverSplash.setVisible(false);

    this.ProceedBtn = this.add.image(config.width / 2, config.height * 0.8, "ProceedBtn");
    this.ProceedBtn.setVisible(false);
    this.ProceedBtn.setInteractive();
    this.ProceedBtn.on('pointerdown', this.buttonAnimEffect.bind(this, self.ProceedBtn, function(){
      self.GenerateNextBingoAnswer();
      }));

    this.SelectionBox = this.add.image(0, 0, "SelectionBox").setVisible(false);
  }

  /*********************/
  // Create answer reveal cells
  // gamemaster and players need to 
  // see the bingo revealed answers
  /*********************/
  CreateAnswerRevealCells() {
    let startPosX = 100;
    let startPosY = 100;
    let gap = 60;

    this.RevealedBoard = [];

    for (let index = 0; index < g_MaxCells; ++index) {
      let cell = this.add.image(startPosX + index * gap, startPosY, "Cell_0");

      cell.setScale(0.1);
      cell.setVisible(false);
      this.RevealedBoard.push(cell);
    }
  }

  /*********************/
  // Generate next bingo answer
  /*********************/
  GenerateNextBingoAnswer() {

    // game master randomly generate bingo answer
    if (this.IsGameMaster) {
      if (g_Answer.length > 0) {

        let rngElementIndex = Math.floor(Math.random() * g_Answer.length);
        let rngAnswer = g_Answer[rngElementIndex];

        this.socket.emit('NextBingoAnswerGenerated', rngAnswer);

        // remove for future consideration
        g_Answer.splice(rngElementIndex, 1);
      }
    }
  }

  /*********************/
  // Game master resets the bingo answers table
  /*********************/
  ResetBingoAnswers() {

    g_Answer = [];

    for (let index = 0; index < g_MaxCells; ++index) {
      g_Answer.push(index);
    }
  }

  /*********************/
  // Handle all the server callbacks
  /*********************/
  serverCallbackHandlers() {

    var self = this;

    /***** when new player joins *****/
    this.socket.on('NewPlayerJoinedServer', function (allPlayers) {
      self.GenericRefreshStatus(allPlayers);
    });

    /***** wwhen player disconnects *****/
    this.socket.on('OnClientDisconnected', function (allPlayers) {
      self.GenericRefreshStatus(allPlayers);
    });

    /***** server is saying that a game master has now been assigned *****/
    this.socket.on('GameMasterAssigned', function (allPlayers) {
      self.GenericRefreshStatus(allPlayers);
    });

    /***** new bingo answer generated but not revealed *****/
    this.socket.on('OnNextBingoAnswerGenerated', function (currQns, rngBingoIndex) {

      let nextReveal = self.RevealedBoard[currQns];

      nextReveal.setVisible(true);

      // only game master gets to see
      if (self.IsGameMaster) {
        nextReveal.setTexture("Cell_" + rngBingoIndex);

        self.questionNumText.setText(currQns);
      }
      // player see question mark before reveal
      else {
        nextReveal.setTexture("QuestionMark");

        self.ToggleBoardInteractive(true);

        self.ConfirmBtn.setAlpha(1.0);
        self.ConfirmBtn.setInteractive();
      }
    });

    /***** server is telling me that game master is disconnected *****/
    this.socket.on('GameMasterDisconnected', function () {
      self.registry.destroy();
      self.events.off();
      self.scene.restart();
    });

    /***** game master gets reply about player makes a selection *****/
    this.socket.on('OnPlayerMadeBingoSelection', function (allPlayers) {

      self.GenericRefreshStatus(allPlayers);
      console.log("GameMaster---------------OnPlayerMadeBingoSelection");
    });
  }

  /*********************/
  // Based on if GM is selected etc and count of players
  /*********************/
  GenericRefreshStatus(allPlayers)
  {
    console.log(allPlayers);
    if(allPlayers)
    {
      let gameMasterExists = allPlayers.find(function(currPlayer){return currPlayer.isGameMaster});

      // only show name form if game master not assigned yet
      this.NameFormElement.setVisible(!gameMasterExists);

      // proceed game btn only available to game master
      this.ProceedBtn.setVisible(gameMasterExists && this.IsGameMaster);

      this.ConfirmBtn.setVisible(gameMasterExists && !this.IsGameMaster);

      this.ToggleBoardVisibility(gameMasterExists && !this.IsGameMaster);

      // exclude the game master
      if (this.playerChoicesLeftText) {

        let unSelectedPlayers = 0;
        allPlayers.forEach(function (item) {
          if (!item.isGameMaster && !item.madeSelection) {
            ++unSelectedPlayers;
          }
        });

        this.playerChoicesLeftText.setText(unSelectedPlayers);
      }
    }
  }

  /*********************/
  // Cilent lock in selection 
  // on bingo board
  /*********************/
  ConfirmBingoSelection()
  {
    this.ToggleBoardInteractive(false);
    this.ConfirmBtn.setAlpha(0.5);
    this.ConfirmBtn.disableInteractive();

    console.log(this.socket.id);
    this.socket.emit('playerConfirmBingoSelection');
  }

  /*********************/
  // Helper to create name form 
  // for game master register
  /*********************/
  createNameForm() {

    this.NameFormElement = this.add.dom(config.width * 0.85, 50).createFromCache('nameform');

    this.NameFormElement.addListener('click');

    var self = this;

    this.NameFormElement.on('click', function (event) {
      if (event.target.name === 'loginButton') {
        var inputUsername = this.getChildByName('username');

        if (inputUsername.value !== '') {

          // check for game master log in
          if (inputUsername.value == "GameMaster") {

            //  Turn off the click events
            this.removeListener('click');

            self.registerAsGameMaster();
          }
        }
      }
    });
  }

  /*********************/
  // Register myself as client
  // game master
  /*********************/
  registerAsGameMaster() {

    this.add.text(0, 10, "GameMaster");
    this.add.text(0, 30, "Players choices left : ");
    this.add.text(0, 50, "Question Num : ");

    this.playerChoicesLeftText = this.add.text(220, 30, "20");
    this.questionNumText = this.add.text(150, 50, "-1");

    this.NameFormElement.setVisible(false);

    this.ProceedBtn.setVisible(true);

    this.IsGameMaster = true;

    // tell server
    this.socket.emit('RegisterAsGameMaster');
  }
    
  /*********************/
  // show/hide game board
  /*********************/
  ToggleBoardVisibility(showFlag) {
    g_Board.forEach(function (item) {
      item.setVisible(showFlag);
    });
  }

  /*********************/
  // board interaction
  /*********************/
  ToggleBoardInteractive(interactiveFlag) {
    g_Board.forEach(function (item) {

      item.disableInteractive();
      item.setAlpha(0.5);

      if (interactiveFlag && !item.chosen) {
        item.setInteractive();
        item.setAlpha(1.0);
      }
    });
  }

  /*********************/
  // Helper to create the 
  // bingo board
  /*********************/
  createBoard() {
    let displayGrid = this.shuffleDisplayGrid();

    let startPosX = 100;
    let startPosY = 100;
    let gap = 130;

    let currIndex = 0;

    for (let row = 0; row < g_MaxRow; ++row) {
      for (let col = 0; col < g_MaxCol; ++col) {

        let targetPosX = startPosX + col * gap;
        let targetPosY = startPosY + row * gap;

        let cellID = displayGrid[currIndex];
        let cellBtn = this.add.image(targetPosX, targetPosY, "Cell_" + cellID);
        cellBtn.disableInteractive();
        cellBtn.on('pointerdown', this.buttonAnimEffect.bind(this, cellBtn, this.OnBingoCellClicked.bind(this, cellID)));
        cellBtn.setScale(0.2);
        cellBtn.setAlpha(0.5);

        // create a green tick
        let greenTick = this.add.image(targetPosX, targetPosY, "GreenTick").setScale(0.5);
        greenTick.setVisible(false);

        // creating the cell assets
        cellBtn.cellID = cellID;
        cellBtn.boardStatus = 0;
        cellBtn.greenTick = greenTick;
        cellBtn.chosen = false;

        ++currIndex;

        g_Board.push(cellBtn);
      }
    }
  }

  /////////////////////////////////
  // randomly arrange the bingo cells
  /////////////////////////////////
  shuffleDisplayGrid() {
    let randomDisplayTable = [];

    for (let i = 0; i < g_MaxCells; ++i) {
      randomDisplayTable.push(i);
    }

    // shuffle the bingo cells
    for (let index = randomDisplayTable.length - 1; index > 0; --index) {
      let rngIndex = Math.floor(Math.random() * (index + 1));
      let temp = randomDisplayTable[index];
      randomDisplayTable[index] = randomDisplayTable[rngIndex];
      randomDisplayTable[rngIndex] = temp;
    }

    return randomDisplayTable;
  }

  /***************************/
  // Touch input dected for a cell
  /***************************/
  OnBingoCellClicked(cellID) {
    // this is bind with cellID
    console.log(cellID);

    for (let index = 0; index < g_MaxCells; ++index) {
      let targetCell = g_Board[index];

      // default
      targetCell.chosen = false;

      // this is the selected cell
      if (targetCell.cellID == cellID) {
        
        targetCell.chosen = true;

        this.SelectionBox.setVisible(true);
        this.SelectionBox.setPosition(targetCell.x, targetCell.y);

        // // check answer based on qns number now
        // if (g_Answer[g_QnsNumber] == cellID) {
        //   // correct
        //   targetCell.boardStatus = 1;
        //   targetCell.greenTick.setVisible(true);
        // }
        // else {
        //   targetCell.boardStatus = -1;
        // }
      }
    }

    // let result = this.CheckBoardForBingo();
    // if (result == true) {
    //   this.OnGameOver();
    // }

    // this.qnsNumber.setText(g_QnsNumber);

    // // do this last
    // ++g_QnsNumber;
  }

  /***************************/
  // Game Over
  /***************************/
  OnGameOver() {
    this.GameOverSplash.setVisible(true);
    for (let index = 0; index < g_MaxCells; ++index) {
      let targetCell = g_Board[index];
      targetCell.disableInteractive();
    }

    // fireworks display
    for (var index = 0; index < this.fireworksArray.length; ++index) {

      let targetFireworkSprite = this.fireworksArray[index];
      targetFireworkSprite.visible = false;
      // random delay call
      this.time.delayedCall(index * 1000, function () {
        targetFireworkSprite.visible = true;
        targetFireworkSprite.play("FireworksEmit");
      }, [], targetFireworkSprite);

      this.children.bringToTop(this.fireworksArray[index]);
    }
  }

  /***************************/
  // check for board completion
  /***************************/
  CheckBoardForBingo() {
    let checkCounter = 0;

    // check horizontal
    for (let row = 0; row < g_MaxRow; ++row) {
      // next row, reset counter
      checkCounter = g_MaxCol;
      for (let col = 0; col < g_MaxCol; ++col) {
        let targetCell = this.getBoardElement(row, col);

        // cell is flipped
        if (targetCell.boardStatus == 1) {
          --checkCounter;
          if (checkCounter == 0) {
            return true;
          }
        }
      }
    }

    // check Vertical
    for (let col = 0; col < g_MaxCol; ++col) {
      // next row, reset counter
      checkCounter = g_MaxRow;
      for (let row = 0; row < g_MaxRow; ++row) {
        let targetCell = this.getBoardElement(row, col);

        // cell is flipped
        if (targetCell.boardStatus == 1) {
          --checkCounter;
          if (checkCounter == 0) {
            return true;
          }
        }
      }
    }

    // check diagonal (L to R)
    // next row, reset counter
    checkCounter = g_MaxCol;
    for (let col = 0; col < g_MaxCol; ++col) {
      let targetCell = this.getBoardElement(col, col);

      // cell is flipped
      if (targetCell.boardStatus == 1) {
        --checkCounter;
        if (checkCounter == 0) {
          return true;
        }
      }
    }

    // check diagonal (R to L)
    // next row, reset counter
    checkCounter = g_MaxCol;
    let rowIter = g_MaxRow - 1;
    for (let col = 0; col < g_MaxCol; ++col) {
      let targetCell = this.getBoardElement(rowIter, col);

      // cell is flipped
      if (targetCell.boardStatus == 1) {
        --checkCounter;
        if (checkCounter == 0) {
          return true;
        }
      }

      --rowIter;
    }
  }

  /***************************/
  // Helper to get board element based on row/col
  /***************************/
  getBoardElement(row, col) {
    return g_Board[col + (row * g_MaxCol)];
  }

  /***************************/
  // Generic Btn Click Effect
  /***************************/
  buttonAnimEffect(img, callback) {
    this.tweens.add({
      targets: img,
      scaleX: img.scaleY * 1.2,
      scaleY: img.scaleX * 1.2,
      duration: 80,
      onComplete: callback,
      yoyo: true
    });

    //this.sound.play('ButtonClick_SFX');
  }
}

//////////////////
// Configurations
/////////////////
var config =
{
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'phaser-example',
  dom: {
    createContainer: true
  },
  scene: [MainGame]
};

var game = new Phaser.Game(config);
game.scene.start('MainGame');


