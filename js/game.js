//////////////////
// GLOBALS
/////////////////
g_MaxCells = 16;
g_MaxRow = 4;
g_MaxCol = 4;

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

    // prompt messages
    this.load.image("SelectionPrompt", 'assets/SelectionPrompt.png');
    this.load.image("WaitForTurnPrompt", 'assets/WaitForTurnPrompt.png');
    this.load.image("AnswerRevealPrompt", 'assets/AnswerRevealPrompt.png');
    this.load.image("EndGamePrompt", 'assets/EndGamePrompt.png');
    this.load.image("GameInProgressPrompt", 'assets/GameInProgressPrompt.png');

    this.load.image("GameWin", 'assets/GameWin.png');
    this.SelectionPromptTex = "SelectionPrompt";
    this.WaitForTurnPromptTex = "WaitForTurnPrompt";
    this.AnswerRevealPromptTex = "AnswerRevealPrompt";
    this.GameInProgressPrompt = "GameInProgressPrompt";

    this.EndGamePromptTex = "EndGamePrompt";

    this.GameWinTex = "GameWin";

    this.load.image("IntendedCorrectAns", 'assets/IntendedCorrectAns.png');

    this.ResetBingoAnswers();

    // load the row/col checks images
    this.load.image('CheckBingoHighlighter', 'assets/CheckBingoHighlighter.png');
    
    this.load.image('Grid', 'assets/Grid.png');

    this.load.image('RevealBar', 'assets/RevealBar.png');

    this.load.spritesheet('Fireworks', 'assets/Fireworks.png', { frameWidth: 64, frameHeight: 64 });
  }

  /*********************/
  // Phaser create
  /*********************/
  create() {
    var self = this; // cache

    // BG
    this.cameras.main.setBackgroundColor(0xECECC4);

    this.Grid = this.add.image(config.width * 0.5, config.height * 0.58, "Grid");
    this.Grid.setScale(1.4).setVisible(false);

    this.RevealBar = this.add.image(config.width * 0.5, config.height * 0.15, "RevealBar");
    this.RevealBar.setScale(1.0).setVisible(false);

    // this is at the bottom
    this.CheckBingoHighlighter = this.add.image(0, 0, "CheckBingoHighlighter").setVisible(false);

    // remind server that I am added
    this.socket = io.connect();
    this.socket.emit('askNewPlayer');

    this.createNameForm();

    this.CreateAnswerRevealCells();

    this.serverCallbackHandlers();

    this.createBoard();

    this.ToggleBoardVisibility(false);

    // players have confirm btns
    this.ConfirmBtn = this.add.image(config.width * 0.9, config.height * 0.9, "ConfirmBtn");
    this.ConfirmBtn.setScale(0.8);
    this.ConfirmBtn.setVisible(false);
    this.ConfirmBtn.on('pointerdown', this.buttonAnimEffect.bind(this, this.ConfirmBtn, function(){
      self.ConfirmBingoSelection();
      }));

    this.ToggleBtnState(this.ConfirmBtn, false);

    this.GameOverSplash = this.add.image(config.width / 2, config.height / 2, "GameOverSplash");
    this.GameOverSplash.setVisible(false);

    this.ProceedBtn = this.add.image(config.width / 2, config.height * 0.8, "ProceedBtn");
    this.ProceedBtn.setVisible(false);
    this.ProceedBtn.on('pointerdown', this.buttonAnimEffect.bind(this, self.ProceedBtn, function(){
      self.GenerateNextBingoAnswer();
      }));

    this.SelectionBox = this.add.image(0, 0, "SelectionBox").setVisible(false);
    this.SelectionBox.setScale(0.8);

    this.PromptMSG = this.add.image(config.width / 2, config.height * 0.05, this.WaitForTurnPromptTex).setVisible(true);
  
    this.IntendedCorrectAnsMSG = this.add.image(0, 0, "IntendedCorrectAns");
    this.IntendedCorrectAnsMSG.setVisible(false);

    // create fireworks
    this.fireworksArray = [];
    for (var index = 0; index < 5; ++index) {
      let fireworksSprite = this.add.sprite(Phaser.Math.Between(0, config.width), Phaser.Math.Between(0, config.height), "Fireworks");
      fireworksSprite.setScale(2.5);
      fireworksSprite.setVisible(false);
      this.fireworksArray.push(fireworksSprite);
    }

    this.anims.create({
      key: "FireworksEmit",
      frames: this.anims.generateFrameNumbers('Fireworks',
        { start: 0, end: 30 }),
      frameRate: 20,
      repeat: -1
    });

    //  let firstCell = this.getBoardElement(2, 0);
    //  let lastCell = this.getBoardElement(0, 2);
    //  this.HighlightWinningCombo(firstCell, lastCell);
  }


  /***************************/
  // once there is a winning bingo, show lighting sprite overlay
  /***************************/
  HighlightWinningCombo(firstCell, lastCell)
  {
    this.CheckBingoHighlighter.setVisible(true);
    let midPtX = firstCell.x + ((lastCell.x - firstCell.x) / 2);
    let midPtY = firstCell.y + ((lastCell.y - firstCell.y) / 2);

    this.CheckBingoHighlighter.setPosition(midPtX, midPtY);

    let rotAngle = Phaser.Math.Angle.Between(lastCell.x, lastCell.y, firstCell.x, firstCell.y);

    rotAngle = Phaser.Math.RadToDeg(rotAngle);
    console.log(rotAngle);
    this.CheckBingoHighlighter.angle = rotAngle;
  }


  /*********************/
  // Create answer reveal cells
  // gamemaster and players need to 
  // see the bingo revealed answers
  /*********************/
  CreateAnswerRevealCells() {
    let startPosX = config.width * 0.19;
    let startPosY = config.height * 0.15;
    let gap = 33;

    this.RevealedBoard = [];

    for (let index = 0; index < g_MaxCells; ++index) {
      let cell = this.add.image(startPosX + index * gap, startPosY, "Cell_0");

      cell.setScale(0.4);
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
    this.socket.on('NewPlayerJoinedServer', function (currQns, allPlayers) {

      self.BingoComplete = false;

      console.log("New Player joined client/player side");
      console.log("All Players Status");
      console.log(allPlayers);

      self.GenericRefreshStatus(allPlayers);
      self.ToggleBoardInteractive(false);

      if (currQns > 0) {
        self.ToggleBoardVisibility(false);
        self.PromptMSG.setTexture(self.GameInProgressPrompt);
        self.ConfirmBtn.setVisible(false);
        self.GenericRefreshStatus(allPlayers);
      }

      if(!self.IsGameMaster)
      {
        self.Grid.setVisible(true);
        self.RevealBar.setVisible(true);
      }
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
    this.socket.on('OnNextBingoAnswerGenerated', function (currQns, rngBingoIndex, allPlayers) {

      if (self.BingoComplete) {
        return;
      }

      let nextReveal = self.RevealedBoard[currQns];
      if (nextReveal) {

        nextReveal.setVisible(true);

        console.log("OnNextBingoAnswerGenerated " + rngBingoIndex);

        // only game master gets to see
        if (self.IsGameMaster) {
          nextReveal.setTexture("Cell_" + rngBingoIndex);

          self.questionNumText.setText(currQns);

          self.GameMasterStateText.setText("Next Bingo answer generated, waiting for players to pick....");

          // disable game master proceeding the game
          self.ProceedBtn.setVisible(false);

          self.WinnersThisRound = 0;
          self.WinnersThisRoundText = this.WinnersThisRound;

          if (self.IsGameMaster) {
            self.UpdateUnselectedPlayerText(allPlayers);
          }
        }
        // Player can now pick
        else {
          self.ReadyForPlayerPick(nextReveal);
        }
      }
    });

    /***** server is telling me that game master is disconnected *****/
    this.socket.on('GameMasterDisconnected', function () {
      self.registry.destroy();
      self.events.off();
      self.scene.restart();
    });

    /***** game master gets reply about player makes a selection *****/
    this.socket.on('OnPlayerMadeBingoSelection', function (allPlayers, currQnsNumber) {

      self.GenericRefreshStatus(allPlayers);
      
      self.PromptMSG.setTexture(this.WaitForTurnPromptTex);

      let unSelectedPlayers = 0;
      allPlayers.forEach(function (item) {
        if (!item.isGameMaster && !item.madeSelection && item.validPlayer) {
          ++unSelectedPlayers;
        }
      });

      // check if we are waiting on anymore players to make selection
      if(unSelectedPlayers <= 0)
      {
        self.GameMasterStateText.setText("All players done picking, revealing answer to them")

        // all done or continue
        if (self.IsGameMaster) {
          self.ProceedBtn.setVisible(currQnsNumber < g_MaxCells);
        }

        self.socket.emit('AllPlayersDoneSelection');
      }
    });

    /***** reveal the generated bingo answer for this pick *****/
    this.socket.on('RevealBingoAnswer', function (currQns, rngBingoIndex) {

      if (self.BingoComplete) {
        return;
      }

      if (currQns >= g_MaxCells) {
        return;
      }

      if (!self.IsGameMaster) {
        console.log("RevealBingoAnswer " + rngBingoIndex);
        let nextReveal = self.RevealedBoard[currQns];

        if (nextReveal) {
          nextReveal.setVisible(true);
          nextReveal.setTexture("Cell_" + rngBingoIndex);

          //self.PromptMSG.setTexture(this.WaitForTurnPromptTex);
          self.ValidateBingoAnswer(currQns, rngBingoIndex);
        }
      }
    });

    /***** Game master notify that a player bingoed *****/
    this.socket.on('OnGMNotifyBingoComplete', function (socketPlayer) {
      this.WinnersThisRound++;
      this.WinnersThisRoundText = this.WinnersThisRound;
    });
  }

  /*********************/
  // mark/validate the board
  /*********************/
  ValidateBingoAnswer(currQns, bingoAnswerIndex) 
  {
    var self = this;

    this.SelectionBox.setVisible(false);

    if (this.LastChosenBingoCell) {
      if (bingoAnswerIndex == this.LastChosenBingoCell.cellID) {
        console.log("CORRECT");

        this.LastChosenBingoCell.chosen = true;
        this.LastChosenBingoCell.boardStatus = 1;
        this.LastChosenBingoCell.greenTick.setVisible(true);
      }
      else {
        console.log("Wrong");
        this.LastChosenBingoCell.boardStatus = 0;
        this.LastChosenBingoCell.chosen = false;

        let correctBingoCell = null;
        // find the cell that holds the bingo answer and flag it too
        g_Board.find(function(item)
        {
          if(item.cellID == bingoAnswerIndex)
          {
            correctBingoCell = item;
            if(correctBingoCell)
            {
              correctBingoCell.boardStatus = -1;
              correctBingoCell.chosen = true;
              correctBingoCell.setTint(0xFFFFFF);
              self.IntendedCorrectAnsMSG.setVisible(true);
              self.IntendedCorrectAnsMSG.setPosition(correctBingoCell.x, correctBingoCell.y + 40);
            }
          }
        });
      }
    }

    let bingoResult = self.CheckBoardForBingo();
    if(bingoResult)
    {
      self.OnGameOver();
    }
    
    if (currQns + 1 >= g_MaxCells) {
      self.PromptMSG.setTexture(self.EndGamePromptTex);
    }

  }

  /*********************/
  // Board is now ready for picking, new Round etc
  /*********************/
  ReadyForPlayerPick(nextReveal)
  {
    nextReveal.setTexture("QuestionMark");

    this.ToggleBoardInteractive(true);

    this.ToggleBtnState(this.ConfirmBtn, false);

    this.PromptMSG.setVisible(true);
    this.PromptMSG.setTexture(this.SelectionPromptTex);

    this.IntendedCorrectAnsMSG.setVisible(false);

    this.Grid.setVisible(true);
    this.RevealBar.setVisible(true);
  }

    
  /*********************/
  // Helper to enable/disable btn interactable
  /*********************/
  ToggleBtnState(btn, flag) {
    if (flag) {
      btn.setTint(0xffffff);
      btn.setInteractive();
    }
    else {
      btn.setTint(0x646464);
      btn.disableInteractive();
    }
  }

  /*********************/
  // Blink selectable items on the board
  /*********************/
  BlinkSelectableBoardItems()
  {
    var self = this;

    g_Board.forEach(function (item) {
      if (item.blinkTween) {
        item.blinkTween.stop();
      }
    });

    // blink the selections
    g_Board.forEach(function (item) {

      if (!item.chosen) {
        item.blinkTween = self.tweens.add(
          {
            targets: item,
            alpha: { value: 1, duration: 1000 },
            yoyo: true,
            loop: -1
          });
      }
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

      this.ConfirmBtn.setVisible(gameMasterExists && !this.IsGameMaster);

      this.Grid.setVisible(gameMasterExists && !this.IsGameMaster);

      this.RevealBar.setVisible(gameMasterExists && !this.IsGameMaster);

      this.ToggleBoardVisibility(gameMasterExists && !this.IsGameMaster);

      if (this.IsGameMaster) {
        this.UpdateUnselectedPlayerText(allPlayers);
      }
    }
  }

  /*********************/
  // update number of players left to pick
  /*********************/
  UpdateUnselectedPlayerText(allPlayers) {
    // exclude the game master
    if (this.playerChoicesLeftText) {

      let unSelectedPlayers = 0;
      allPlayers.forEach(function (item) {
        if (!item.isGameMaster && !item.madeSelection && item.validPlayer) {
          ++unSelectedPlayers;
        }
      });

      this.playerChoicesLeftText.setText(unSelectedPlayers);
    }
  }

  /*********************/
  // Cilent lock in selection 
  // on bingo board
  /*********************/
  ConfirmBingoSelection()
  {
    this.ToggleBoardInteractive(false);
    this.ToggleBtnState(this.ConfirmBtn, false);

    this.PromptMSG.setTexture(this.WaitForTurnPromptTex);

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

    this.add.text(0, config.height * 0.3, "GameMaster", { color: '#2A2A2A' });
    this.add.text(0, config.height * 0.35, "Unpicked Players : ", { color: '#2A2A2A' });
    this.add.text(0, config.height * 0.40, "Question Num : ", { color: '#2A2A2A' });
    this.add.text(0, config.height * 0.45, "State : ", { color: '#2A2A2A' });
    this.add.text(0, config.height * 0.50, "Winners This Round : ", { color: '#2A2A2A' });
    //this.add.text(0, 110, "Total Winners : ");

    this.playerChoicesLeftText = this.add.text(220, config.height * 0.35, "20", { color: '#2A2A2A' });
    this.questionNumText = this.add.text(150, config.height * 0.4, "-1", { color: '#2A2A2A' });
    this.GameMasterStateText = this.add.text(100, config.height * 0.45, "Waiting For Players, Click Proceed to start/lock Game", { color: '#2A2A2A' });
    this.WinnersThisRoundText = this.add.text(200, config.height * 0.5, "0", { color: '#2A2A2A' });
    //this.TotalWinnersText = this.add.text(150, 110, "0");

    this.NameFormElement.setVisible(false);

    this.ProceedBtn.setVisible(true);
    this.ToggleBtnState(this.ProceedBtn, true);

    this.IsGameMaster = true;

    this.PromptMSG.setVisible(false);

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

    var self = this;

    g_Board.forEach(function (item) {
      self.ToggleBtnState(item, interactiveFlag && !item.chosen);
    });
  }

  /*********************/
  // Helper to create the 
  // bingo board
  /*********************/
  createBoard() {
    let displayGrid = this.shuffleDisplayGrid();

    let startPosX = config.width * 0.28;
    let startPosY = config.height * 0.3;
    let gap = 120;

    let currIndex = 0;

    for (let row = 0; row < g_MaxRow; ++row) {
      for (let col = 0; col < g_MaxCol; ++col) {

        let targetPosX = startPosX + col * gap;
        let targetPosY = startPosY + row * gap;

        let cellID = displayGrid[currIndex];
        let cellBtn = this.add.image(targetPosX, targetPosY, "Cell_" + cellID);
        cellBtn.disableInteractive();
        cellBtn.on('pointerdown', this.buttonAnimEffect.bind(this, cellBtn, this.OnBingoCellClicked.bind(this, cellID)));
        cellBtn.setScale(0.8);

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

    this.LastChosenBingoCell = null;

    //this.ToggleBoardInteractive();

    for (let index = 0; index < g_MaxCells; ++index) {
      let targetCell = g_Board[index];

      targetCell.highlighted = false;

      // this is the selected cell
      if (targetCell.cellID == cellID) {
        
        this.LastChosenBingoCell = targetCell;

        targetCell.highlighted = true;

        this.SelectionBox.setVisible(true);
        this.SelectionBox.setPosition(targetCell.x, targetCell.y);

        this.ToggleBtnState(this.ConfirmBtn, true);
      }
    }
  }

  /***************************/
  // Game Over
  /***************************/
  OnGameOver() {

    this.socket.emit("OnPlayerBingoComplete");

    //this.GameOverSplash.setVisible(true);
    this.PromptMSG.setTexture(this.GameWinTex);

    this.ToggleBoardInteractive(false);
    
    this.ConfirmBtn.setVisible(false);

    this.BingoComplete = true;

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
    let firstCell = null;
    let lastCell = null;

    // check horizontal
    for (let row = 0; row < g_MaxRow; ++row) {
      firstCell = this.getBoardElement(row, 0);

      // next row, reset counter
      checkCounter = g_MaxCol;
      for (let col = 0; col < g_MaxCol; ++col) {
        let targetCell = this.getBoardElement(row, col);

        // cell is flipped
        if (targetCell.boardStatus == 1) {
          --checkCounter;
          if (checkCounter == 0) {
            lastCell = targetCell;

            this.HighlightWinningCombo(firstCell, lastCell);

            return true;
          }
        }
      }
    }

    // check Vertical
    for (let col = 0; col < g_MaxCol; ++col) {
      firstCell = this.getBoardElement(0, col);

      // next row, reset counter
      checkCounter = g_MaxRow;
      for (let row = 0; row < g_MaxRow; ++row) {
        let targetCell = this.getBoardElement(row, col);

        // cell is flipped
        if (targetCell.boardStatus == 1) {
          --checkCounter;
          if (checkCounter == 0) {

            lastCell = targetCell;

            this.HighlightWinningCombo(firstCell, lastCell);

            return true;
          }
        }
      }
    }

    // check diagonal (L to R)
    // next row, reset counter
    checkCounter = g_MaxCol;
    firstCell = this.getBoardElement(0, 0);

    for (let col = 0; col < g_MaxCol; ++col) {
      let targetCell = this.getBoardElement(col, col);

      // cell is flipped
      if (targetCell.boardStatus == 1) {
        --checkCounter;
        if (checkCounter == 0) {
          lastCell = targetCell;
          this.HighlightWinningCombo(firstCell, lastCell);

          return true;
        }
      }
    }

    // check diagonal (R to L)
    // next row, reset counter
    checkCounter = g_MaxCol;
    let rowIter = g_MaxRow - 1;
    firstCell = this.getBoardElement(rowIter, 0);

    for (let col = 0; col < g_MaxCol; ++col) {
      let targetCell = this.getBoardElement(rowIter, col);

      // cell is flipped
      if (targetCell.boardStatus == 1) {
        --checkCounter;
        if (checkCounter == 0) {
          lastCell = targetCell;
          this.HighlightWinningCombo(firstCell, lastCell);
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


