/**
 * 이 파일은 미니톡 장기 플러그인의 일부입니다. (https://www.minitalk.io)
 *
 * 박스에 장기대국을 추가합니다.
 * 
 * @file /plugins/janggi/script.js
 * @author Arzz (arzz@arzz.com)
 * @license MIT License
 * @version 1.0.0
 * @modified 2021. 2. 5.
 */
if (Minitalk === undefined) return;

/**
 * 장기대전 객체를 정의한다.
 */
me.timelimit = 300; // 대국시간(초)
me.timecount = 3; // 초읽기 기회
me.game = {
	minitalk:null,
	step:0,
	data:null,
	timer:null,
	timerCount:0,
	timerCallback:null,
	/**
	 * 대국자정보를 저장한다.
	 */
	status:{
		turn:"cho", // 초나라가 먼저 시작한다.
		stones:null,
		han:{user:null,position:-1,data:null,timer:me.timelimit,timecount:me.timecount,timecounting:false,connected:false}, // 한나라 대국상태
		cho:{user:null,position:-1,data:null,timer:me.timelimit,timecount:me.timecount,timecounting:false,connected:false} // 초나라 대국상태
	},
	/**
	 * 대국을 초기화한다.
	 */
	init:function(minitalk) {
		/**
		 * 클래스 내부에서 사용하기 위해 미니톡 객체를 저장한다.
		 */
		me.game.minitalk = minitalk;
		
		/**
		 * 전적을 가져온다
		 */
		me.game.data = minitalk.storage("@janggi") ? minitalk.storage("@janggi") : {win:0,lose:0};
		
		/**
		 * 장기판에 기물이 놓이는 좌표를 추가한다.
		 */
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		for (var x=0;x<=8;x++) {
			for (var y=0;y<=9;y++) {
				var $point = $("<div>").attr("data-role","position").attr("data-x",x).attr("data-y",y);
				$board.append($point);
			}
		}
		
		/**
		 * 게임버튼을 추가한다.
		 */
		var $gamebuttons = $("div[data-role=gamebuttons]",$janggi);
		$gamebuttons.append($("<button>").attr("data-action","pass").html("한수쉬기"));
		$gamebuttons.append($("<button>").attr("data-action","draw").html("기권하기"));
		$gamebuttons.append($("<button>").attr("data-action","reset").html("전적리셋"));
		$gamebuttons.append($("<button>").attr("data-action","close").html("게임종료"));
		
		$("button",$gamebuttons).on("click",function() {
			var action = $(this).attr("data-action");
			
			if (action == "pass") {
				if (me.game.team == null || me.game.step != 10) {
					me.game.printConfirm("안내","지금은 대국중이 아닙니다.",[{
						text:"확인",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
					return;
				}
				
				if (me.game.status.turn != me.game.team) {
					me.game.printConfirm("안내","나의 턴이 아닙니다.",[{
						text:"확인",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
					return;
				}
				
				me.game.printAlert("turn","한수를 쉽니다.");
				me.game.playSound("pass");
				me.game.endTurn();
			}
			
			if (action == "draw") {
				if (me.game.team == null || me.game.step != 10) {
					me.game.printConfirm("안내","지금은 대국중이 아닙니다.",[{
						text:"확인",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
					return;
				}
				
				if (me.game.status.turn != me.game.team) {
					me.game.printConfirm("안내","나의 턴이 아닙니다.",[{
						text:"확인",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
					return;
				}
				
				me.game.printConfirm("안내","기권하시겠습니까?",[{
					text:"확인",
					handler:function() {
						me.game.playSound("button");
						minitalk.socket.sendProtocol("draw",me.game.team);
						me.game.winner(me.game.team == "han" ? "cho" : "han");
						me.game.closeConfirm();
					}
				},{
					text:"취소",
					handler:function() {
						me.game.playSound("button");
						me.game.closeConfirm();
					}
				}]);
			}
			
			if (action == "reset") {
				me.game.printConfirm("안내","대국관전을 종료하시겠습니까?",[{
					text:"확인",
					handler:function() {
						self.close();
					}
				},{
					text:"취소",
					handler:function() {
						me.game.playSound("button");
						me.game.closeConfirm();
					}
				}]);
			}
			
			if (action == "close") {
				if (me.game.team == null) {
					me.game.printConfirm("안내","게임전적을 리셋하시겠습니까?",[{
						text:"확인",
						handler:function() {
							me.game.playSound("button");
							me.game.data.win = 0;
							me.game.data.lose = 0;
							
							minitalk.storage("@janggi",me.game.data);
							
							me.game.printConfirm("안내","전적을 초기화하였습니다.",[{
								text:"확인",
								handler:function() {
									me.game.playSound("button");
									me.game.closeConfirm();
								}
							}]);
						}
					},{
						text:"취소",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
				} else {
					me.game.printConfirm("안내","대국을 종료하시겠습니까?" + (me.game.step == 10 ? "<br>게임 종료시 기권처리됩니다." : ""),[{
						text:"확인",
						handler:function() {
							if (me.game.step == 10) {
								minitalk.socket.sendProtocol("draw",me.game.team);
								me.game.winner(me.game.team == "han" ? "cho" : "han",true);
							} else {
								self.close();
							}
						}
					},{
						text:"취소",
						handler:function() {
							me.game.playSound("button");
							me.game.closeConfirm();
						}
					}]);
				}
			}
		});
		
		/**
		 * 대국시작여부 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("invite",function(minitalk,data,to,from) {
			me.game.playSound("match");
			me.game.printMessage("대국초대",from.nickname + "님이 장기대국을 신청하였습니다.<br>대국초대를 수락하시겠습니까?",[{
				text:"수락하기",
				handler:function() {
					me.game.playSound("button");
					minitalk.socket.sendProtocol("accept",me.game.data,from.nickname);
					me.game.closeMessage();
				}
			},{
				text:"관전하기",
				handler:function() {
					me.game.playSound("button");
					me.game.closeMessage();
					minitalk.ui.sendMessage("저는 관전만 하겠습니다.");
				}
			}]);
		});
		
		/**
		 * 대국수락 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("accept",function(minitalk,data,to,from) {
			/**
			 * 내가 방장인 경우에만 처리한다.
			 */
			if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
				// 아직 상대가 정해지지 않은 경우
				if (me.game.step == 0 || me.game.step == 20) {
					me.game.status = {
						turn:"cho", // 초나라가 먼저 시작한다.
						stones:null,
						han:{user:null,position:-1,data:null,timer:me.timelimit,timecount:me.timecount,timecounting:false,connected:false}, // 한나라 대국상태
						cho:{user:null,position:-1,data:null,timer:me.timelimit,timecount:me.timecount,timecounting:false,connected:false} // 초나라 대국상태
					};
					
					me.game.step = 1;
					
					// 나의 팀을 정한다.
					me.game.team = me.game.getTeam(data);
					
					// 나의 정보를 저장한다.
					me.game.status[me.game.team].user = minitalk.user.me;
					me.game.status[me.game.team].data = me.game.data;
					
					// 상대방의 정보를 저장한다.
					me.game.status[me.game.team == "han" ? "cho" : "han"].user = from;
					me.game.status[me.game.team == "han" ? "cho" : "han"].data = data;
					
					me.game.status.han.connected = true;
					me.game.status.cho.connected = true;
				} else {
					minitalk.socket.sendProtocol("reject",null,from.nickname);
				}
				
				// 대국진행 상태를 전송한다.
				minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status});
				
				// 초기배치를 선택한다.
				if (me.game.step == 1) {
					me.game.selectPosition();
				}
			}
		});
		
		/**
		 * 대국수락 거절 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("reject",function(minitalk) {
			me.game.printMessage("안내","이미 다른 대국자가 결정되어 대국수락이 거절되었습니다.");
		});
		
		/**
		 * 초기배치설정 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("position",function(minitalk,data,to,from) {
			// 내가 방장이고, 상대방이 보낸 메시지가 맞을 경우
			if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
				// 상대방의 팀을 구한다.
				var team = me.game.team == "han" ? "cho" : "han";
				if (me.game.status[team].user.uuid == from.uuid) {
					me.game.status[team].position = data;
					
					// 대국시작가능여부를 확인한다.
					me.game.isReady();
				}
			}
		});
		
		/**
		 * 대국시작 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("start",function(minitalk,data,to,from) {
			// 방장이 보낸 메시지인 경우에만 처리한다.
			if (from.uuid == minitalk.box.connection.uuid) {
				me.game.step = data.step;
				me.game.status = data.status;
				me.game.startGame();
			}
		});
		
		/**
		 * 턴넘김을 처리한다.
		 */
		minitalk.socket.setProtocol("turn",function(minitalk,data,to,from) {
			// 내가 방장이고, 상대방이 보낸 메시지가 맞을 경우
			if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
				// 상대방의 팀을 구한다.
				var team = me.game.team == "han" ? "cho" : "han";
				if (me.game.status[team].user.uuid == from.uuid) {
					me.game.status.turn = me.game.team;
					minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status});
					
					me.game.updateStatus();
				}
			}
		});
		
		/**
		 * 기권을 처리한다.
		 */
		minitalk.socket.setProtocol("draw",function(minitalk,data,to,from) {
			// 대국자가 보낸 것이 맞는 경우
			if (me.game.status[data].user.uuid == from.uuid) {
				me.game.winner(data == "han" ? "cho" : "han");
			}
		});
		
		/**
		 * 타이머 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("timer",function(minitalk,data,to,from) {
			// 대국자가 보낸 것이 맞는 경우
			if (me.game.status[data.team].user.uuid == from.uuid) {
				me.game.status[data.team].timer = data.timer;
				me.game.status[data.team].timecount = data.timecount;
				me.game.status[data.team].timecounting = data.timecounting;
				me.game.updateTimers();
			}
		});
		
		/**
		 * 대국진행상태 프로토콜을 추가한다.
		 */
		minitalk.socket.setProtocol("status",function(minitalk,data,to,from) {
			// 대국상태를 저장한다.
			me.game.status = data.status;
			me.game.step = data.step;
			
			// 내가 대국자인지 확인한다.
			if (data.status.han.user.uuid == minitalk.socket.uuid) {
				me.game.team = "han";
			} else if (data.status.cho.user.uuid == minitalk.socket.uuid) {
				me.game.team = "cho";
			}
			
			// 내가 대국자인경우
			if (me.game.team != null) {
				// 초기배치를 선택한다.
				if (me.game.step == 1) {
					me.game.selectPosition();
				}
				
				if (me.game.step == 10) {
					me.game.updateStatus();
				}
			} else {
				if (me.game.step < 10) {
					
				}
				
				me.game.updateStatus();
			}
		});
		
		/**
		 * 기물을 이동한다.
		 */
		minitalk.socket.setProtocol("move",function(minitalk,data,to,from) {
			me.game.moveStone(data.stone,data.from,data.to);
		});
		
		/**
		 * 미니톡 서버에 접속했을 때 이벤트를 추가한다.
		 */
		minitalk.on("connect",function(minitalk) {
			/**
			 * 내가 방장인 경우 (항상 방장이 대국을 시작한다.)
			 */
			if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
				switch (me.game.step) {
					// 상대를 기다리는중
					case 0 :
						me.game.printMessage("대국대기중","대국자의 대국참여를 기다리는중입니다.");
						break;
				}
			}
		});
		
		/**
		 * 유저가 참여하였을 경우
		 */
		minitalk.on("join",function(minitalk,user) {
			/**
			 * 내가 방장인 경우 (항상 방장이 데이터를 전송한다.)
			 */
			if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
				/**
				 * 대국상대가 정해지지 않은 경우, 대국시작여부를 물어본다.
				 */
				if (me.game.step == 0) {
					minitalk.socket.sendProtocol("invite",null,user.nickname);
				} else if (me.game.step == 5) {
					// 대국자가 다시 접속한 경우, 대국을 재개한다.
					if (me.game.status.han.user.uuid == user.uuid || me.game.status.cho.user.uuid == user.uuid) {
						me.game.resumeGame();
					}
					
					// 대국진행 상태를 전송한다.
					minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status});
				} else if (me.game.step == 20) {
					// 이전 대국자가 종료한 경우
					var enemy = me.game.team == "han" ? "cho" : "han";
					if (me.game.status[enemy].connected == false) {
						minitalk.socket.sendProtocol("invite",null,user.nickname);
					}
				} else {
					// 대국진행 상태를 전송한다.
					minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status},user.nickname);
				}
				
				return;
			}
			
			/**
			 * 대국을 일시중단상태이고, 아직 대국이 진행중이라면, 대국자가 대국상태를 전송한다.
			 */
			if (me.game.step == 5) {
				// 대국자가 다시 접속한 경우, 대국을 재개한다.
				if (me.game.status.han.user.uuid == user.uuid || me.game.status.cho.user.uuid == user.uuid) {
					if (me.game.status.han.user.uuid == user.uuid) {
						me.game.status.han.connected = true;
					} else {
						me.game.status.cho.connected = true;
					}
					me.game.resumeGame();
				}
				
				if (me.game.team != null) {
					// 대국진행 상태를 전송한다.
					minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status});
				}
			}
		});
		
		/**
		 * 유저가 나갔을 경우
		 */
		minitalk.on("leave",function(minitalk,user) {
			// 대국자가 나갔는지 확인한다.
			if (me.game.status.han.user.uuid == user.uuid || me.game.status.cho.user.uuid == user.uuid) {
				if (me.game.status.han.user.uuid == user.uuid) {
					me.game.status.han.connected = false;
				} else {
					me.game.status.cho.connected = false;
				}
				
				// 모두 대국을 종료했다면, 대국종료를 한다.
				if (me.game.status.han.connected == false && me.game.status.cho.connected == false) {
					me.game.endGame();
				} else if (me.game.step < 20) {
					me.game.pauseGame();
				} else if (me.game.step == 20) {
					// 방장이 나갔다면, 게임을 종료한다.
					if (minitalk.box.connection.uuid == user.uuid) {
						me.game.endGame();
					} else {
						me.game.restartGame();
					}
				}
			}
		});
	},
	/**
	 * 타이머를 시작한다.
	 *
	 * @param int count 타임을 셀 카운트
	 * @param function callback
	 */
	startTimer:function(count,callback) {
		if (me.game.timer != null) {
			clearInterval(me.game.timer);
		}
		
		me.game.timerCount = count;
		me.game.timerCallback = callback;
		me.game.timer = setInterval(function() {
			var count = --me.game.timerCount;
			
			if (count >= 0) {
				me.game.timerCallback(count);
			} else {
				if (me.game.timer != null) {
					clearInterval(me.game.timer);
				}
			}
		},1000);
	},
	/**
	 * 타이머를 중지한다.
	 */
	stopTimer:function() {
		if (me.game.timer != null) {
			clearInterval(me.game.timer);
			me.game.timer = null;
		}
	},
	/**
	 * 나의 팀을 가져온다.
	 *
	 * @param object data 상대방 데이터
	 */
	getTeam:function(data) {
		// 상대방 전적이 없다면, 방장이 한나라가 된다.
		if (data.win + data.lose == 0) return "han";
		
		// 내가 전적이 없다면 초나라가 된다.
		if (me.game.data.win + me.game.data.lose == 0) return "cho";
		
		// 나의 승률이 높다면, 한나라가 된다.
		if ((data.win / (data.win + data.lose)) < (me.game.data.win / (me.game.data.win + me.game.data.lose))) return "han";
		else return "cho";
	},
	/**
	 * 초를 분:초 로 변환한다.
	 */
	getTime:function(second) {
		var m = Math.floor(second / 60);
		var s = second % 60;
		return (m == 0 ? "0" : m) + ":" + (s < 10 ? "0" + s : s);
	},
	/**
	 * 알림메시지를 띄운다. (턴전환, 초읽기, 장군 등 알림)
	 */
	printAlert:function(type,message) {
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		
		if ($("div[data-role=alert][data-type=" + type + "]",$panel).length == 1) {
			clearTimeout($("div[data-role=alert][data-type=" + type + "]",$panel).data("timer"));
			$("div[data-role=alert][data-type=" + type + "]",$panel).stop();
			$("div[data-role=alert][data-type=" + type + "]",$panel).remove();
		}
		
		var $alert = $("<div>").attr("data-role","alert").attr("data-type",type);
		var $box = $("<div>").attr("data-role","box");
		
		if (message) {
			$box.html(message);
		}
		
		var timeout = setTimeout(function() {
			var $janggi = $("div[data-role=janggi]");
			var $panel = $("div[data-role=panel]",$janggi);
			var $alert = $("div[data-role=alert]",$panel);
			
			$alert.animate({right:"100%"},"fast",function() {
				$alert.remove();
			});
		},3000);
		
		$alert.append($box);
		$panel.append($alert);
	},
	/**
	 * 메시지를 띄운다.
	 *
	 * @param string title 제목
	 * @param string message 메시지
	 * @param object[] button 버튼
	 */
	printMessage:function(title,message,buttons) {
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		
		me.game.closeMessage();
		
		var $message = $("<div>").attr("data-role","message");
		var $box = $("<div>").attr("data-role","box");
		$message.append($("<div>").append($box));
		
		var $title = $("<h4>").html(title);
		$box.append($title);
		
		var $content = $("<p>").html(message);
		$box.append($content);
		
		var buttons = buttons ? buttons : [];
		if (buttons.length > 0) {
			var $buttons = $("<div>").attr("data-role","buttons");
			for (var i=0, loop=buttons.length;i<loop;i++) {
				var $button = $("<button>").attr("type","button").html(buttons[i].text);
				$button.on("click",buttons[i].handler);
				$buttons.append($button);
			}
			
			$box.append($buttons);
		}
		
		$panel.append($message);
	},
	/**
	 * 메시지를 닫는다.
	 */
	closeMessage:function() {
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		if ($("div[data-role=message]",$panel).length == 1) {
			$("div[data-role=message]",$panel).remove();
		}
	},
	/**
	 * 메시지를 띄운다.
	 *
	 * @param string title 제목
	 * @param string message 메시지
	 * @param object[] button 버튼
	 */
	printConfirm:function(title,message,buttons) {
		var $janggi = $("div[data-role=janggi]");
		
		me.game.closeConfirm();
		
		var $confirm = $("<div>").attr("data-role","confirm");
		var $box = $("<div>").attr("data-role","box");
		$confirm.append($("<div>").append($box));
		
		var $title = $("<h4>").html(title);
		$box.append($title);
		
		var $content = $("<p>").html(message);
		$box.append($content);
		
		var buttons = buttons ? buttons : [];
		if (buttons.length > 0) {
			var $buttons = $("<div>").attr("data-role","buttons");
			for (var i=0, loop=buttons.length;i<loop;i++) {
				var $button = $("<button>").attr("type","button").html(buttons[i].text);
				$button.on("click",buttons[i].handler);
				$buttons.append($button);
			}
			
			$box.append($buttons);
		}
		
		$janggi.append($confirm);
	},
	/**
	 * 메시지를 닫는다.
	 */
	closeConfirm:function() {
		var $janggi = $("div[data-role=janggi]");
		if ($("div[data-role=confirm]",$janggi).length == 1) {
			$("div[data-role=confirm]",$janggi).remove();
		}
	},
	/**
	 * 초기배치를 선택한다.
	 */
	selectPosition:function() {
		var minitalk = me.game.minitalk;
		
		me.game.closeMessage();
		
		me.game.playSound("match");
		me.game.updatePlayers();
		me.game.updateTimers();
		
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		
		var $message = $("<div>").attr("data-role","message");
		var $box = $("<div>").attr("data-role","box");
		$message.append($("<div>").append($box));
		
		var $title = $("<h4>").html("기물위치선택");
		$box.append($title);
		
		var $content = $("<div>").attr("data-role","position").attr("data-position","1");
		$content.addClass(me.game.team);
		
		for (var i=1;i<=4;i++) {
			var $button = $("<button>").attr("type","button").attr("data-position",i);
			if (i == 1) $button.addClass("selected");
			
			$button.on("click",function() {
				me.game.playSound("button");
				$("button",$content).removeClass("selected");
				$(this).addClass("selected");
				$content.attr("data-position",$(this).attr("data-position"));
			});
			$content.append($button);
		}
		
		$box.append($content);
		
		var $buttons = $("<div>").attr("data-role","buttons");
		var $button = $("<button>").attr("type","button").html("선택완료");
		$button.on("click",function() {
			me.game.playSound("button");
			me.game.selectPositionConfirm();
			me.game.stopTimer();
		});
		$buttons.append($button);
		
		$box.append($buttons);
		$panel.append($message);
		
		var $timer = $("<div>").attr("data-role","timer").html("남은시간 : 30초");
		$box.append($timer);
		
		// 30초 타이머를 시작한다.
		me.game.startTimer(30,function(count) {
			var $janggi = $("div[data-role=janggi]");
			var $panel = $("div[data-role=panel]",$janggi);
			var $message = $("div[data-role=message]",$message);
			if ($message.length == 0) return;
			
			var $box = $("div[data-role=timer]",$message);
			$box.html("남은시간 : " + count + "초");
			
			if (count == 0) {
				me.game.playSound("button");
				me.game.selectPositionConfirm();
				me.game.stopTimer();
			}
		});
	},
	/**
	 * 초기배치 선택을 완료한다.
	 */
	selectPositionConfirm:function() {
		var minitalk = me.game.minitalk;
		
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		var $message = $("div[data-role=message]",$panel);
		var $content = $("div[data-role=position]",$message);
		
		var position = parseInt($content.attr("data-position"),10);
		if (position < 1 || position > 4) return;
		
		if (me.game.team == null) return;
		
		me.game.printMessage("기다리는중","상대방의 초기배치설정을 기다리고 있습니다.");
		
		/**
		 * 나의 초기배치설정을 저장한다.
		 */
		me.game.status[me.game.team].position = position;
		
		/**
		 * 방장인 경우, 초기배치설정이 모두 종료되면, 대국을 시작하고,
		 * 아닌 경우, 방장에게 초기배치정보를 전달한다.
		 */
		if (minitalk.socket.uuid == minitalk.box.connection.uuid) {
			// 대국시작가능여부를 확인한다.
			me.game.isReady();
		} else {
			minitalk.socket.sendProtocol("position",position,minitalk.box.connection.owner.nickname);
		}
	},
	/**
	 * 대국시작준비가 되었는지 확인한다.
	 */
	isReady:function() {
		var minitalk = me.game.minitalk;
		
		// 방장이 아닌 경우
		if (minitalk.box.connection.uuid != minitalk.socket.uuid) return;
		
		if (me.game.status.han.user != null && me.game.status.cho.user != null) {
			if (me.game.status.han.position > -1 && me.game.status.cho.position > -1) {
				me.game.step = 10;
				
				// 기물 초기 배치정보를 기록한다.
				me.game.initStones();
				
				// 대국시작 프로토콜을 전송한다.
				minitalk.socket.sendProtocol("start",{step:me.game.step,status:me.game.status});
				
				// 대국을 시작한다.
				me.game.startGame();
			}
		}
	},
	/**
	 * 기물위치를 초기화한다.
	 */
	initStones:function(team) {
		if (team === undefined) {
			// 기물 좌표값을 초기화한다. (stones[x][y])
			me.game.status.stones = [];
			for (var x=0;x<9;x++) {
				me.game.status.stones[x] = [];
				for (var y=0;y<10;y++) {
					me.game.status.stones[x][y] = null;
				}
			}
			
			me.game.initStones("han");
			me.game.initStones("cho");
		}
		
		if (team == "han") {
			var position = me.game.status.han.position;
		} else {
			var position = me.game.status.cho.position;
		}
		
		// 기본위치
		var inits = [
			{idx:1,type:"cha"},
			null,
			null,
			{idx:4,type:"sa"},
			null,
			{idx:5,type:"sa"},
			null,
			null,
			{idx:8,type:"cha"},
			null,
			null,
			null,
			null,
			{idx:9,type:"king"},
			null,
			null,
			null,
			null,
			null,
			{idx:10,type:"po"},
			null,
			null,
			null,
			null,
			null,
			{idx:11,type:"po"},
			null,
			{idx:12,type:"jol"},
			null,
			{idx:13,type:"jol"},
			null,
			{idx:14,type:"jol"},
			null,
			{idx:15,type:"jol"},
			null,
			{idx:16,type:"jol"}
		];
		
		// 마상마상
		if (position == 1) {
			inits[1] = {idx:2,type:"ma"};
			inits[2] = {idx:3,type:"sang"}
			inits[6] = {idx:6,type:"ma"};
			inits[7] = {idx:7,type:"sang"}
		}
		
		// 상마상마
		if (position == 2) {
			inits[1] = {idx:2,type:"sang"};
			inits[2] = {idx:3,type:"ma"}
			inits[6] = {idx:6,type:"sang"};
			inits[7] = {idx:7,type:"ma"}
		}
		
		// 마상상마
		if (position == 3) {
			inits[1] = {idx:2,type:"ma"};
			inits[2] = {idx:3,type:"sang"}
			inits[6] = {idx:6,type:"sang"};
			inits[7] = {idx:7,type:"ma"}
		}
		
		// 상마마상
		if (position == 4) {
			inits[1] = {idx:2,type:"sang"};
			inits[2] = {idx:3,type:"ma"}
			inits[6] = {idx:6,type:"ma"};
			inits[7] = {idx:7,type:"sang"}
		}
		
		// 기물 좌표값은 무조건 한나라가 상위에 배치된다.
		if (team == "han") {
			for (var i=0, loop=inits.length;i<loop;i++) {
				if (inits[i] == null) continue;
				
				inits[i].team = "han";
				var x = 8 - (i % 9);
				var y = Math.floor(i/9);
				
				me.game.status.stones[x][y] = inits[i];
			}
		} else {
			for (var i=0, loop=inits.length;i<loop;i++) {
				if (inits[i] == null) continue;
				
				inits[i].team = "cho";
				var x = i % 9;
				var y = 9 - Math.floor(i/9);
				
				me.game.status.stones[x][y] = inits[i];
			}
		}
	},
	/**
	 * 대국을 시작한다.
	 */
	startGame:function() {
		var minitalk = me.game.minitalk;
		
		// 시작음을 출력한다.
		me.game.playSound("start");
		
		// 메시지창을 닫는다.
		me.game.closeMessage();
		
		// 상태를 업데이트한다.
		me.game.updateStatus();
	},
	/**
	 * 대국을 중단한다.
	 */
	pauseGame:function() {
		// 대국단계를 조절한다.
		me.game.step = 5;
		
		// 대국자가 아니라면
		if (me.game.team == null) {
			me.game.printMessage("대국자 재접속 대기중...","대국자 중 한명이 종료하여, 재참여를 기다리거나 대국승패판정을 기다리고 있습니다.");
			return;
		}
		
		// 대국자라면
		if (me.game.team != null) {
			// 나의 턴이라면, 타이머를 중단한다.
			if (me.game.status.turn == me.game.team) {
				me.game.stopTimer();
			}
			
			me.game.startTimer(60,function(count) {
				me.game.printMessage("재접속 대기중...","상대 대국자가 대국을 종료하였습니다.<br><b>" + count + "</b>초 이내에 상대방이 재접속하지 않는 경우 대국에서 승리하게 됩니다.");
				
				if (count == 0) {
					me.game.winner(me.game.team);
				}
			});
		}
	},
	/**
	 * 대국을 재개한다.
	 */
	resumeGame:function() {
		// 대국단계를 조절한다.
		if (me.game.status.han.position > -1 && me.game.status.cho.position > -1) {
			me.game.step = 10;
		} else {
			me.game.step = 1;
		}
		
		// 초읽기중이었다면, 시간을 조절한다.
		if (me.game.status[me.game.status.turn].timecounting == true) {
			me.game.status[me.game.status.turn].timer = 60;
			me.game.updateTimers();
		}
		
		if (me.game.step == 10) {
			me.game.closeMessage();
			
			// 대국 대국자라면
			if (me.game.team != null) {
				me.game.stopTimer();
				me.game.updateTurn();
			}
		} else if (me.game.step == 1) {
			// 대국자라면, 기물선택창을 띄운다.
			if (me.game.team != null) {
				me.game.stopTimer();
				me.game.selectPosition();
			} else {
				me.game.printMessage("대국시작 대기중...","아직 대국이 시작되지 않았습니다.<br>대국이 시작되면 관전할 수 있습니다.");
			}
		}
	},
	/**
	 * 대국을 종료한다.
	 */
	endGame:function() {
		me.game.printMessage("대국종료","대국자가 모두 채널을 떠났거나, 대국재시작을 하지 않았으므로, 이 채널에서 대국은 더이상 진행되지 않습니다.",[{
			text:"나가기",
			handler:function() {
				self.close();
			}
		}]);
	},
	/**
	 * 게임을 재시작한다.
	 */
	restartGame:function() {
		var minitalk = me.game.minitalk;
		
		// 방장이 아닌경우 재시작하지 않는다.
		if (minitalk.box.connection.uuid != minitalk.socket.uuid) return;
		
		// 대국자가 접속중인 경우
		var enemy = me.game.team == "han" ? "cho" : "han";
		if (me.game.status[enemy].connected == true) {
			me.game.printMessage("재대국신청중","상대방의 재대국의사를 기다리고 있습니다.<br>잠시만 기다려주십시오.");
			minitalk.socket.sendProtocol("invite",null,me.game.status[enemy].user.nickname);
		} else {
			me.game.printMessage("재대국신청중","현재 채널에 접속중인 유저에게 게임참여 의사를 물어보고 있습니다.<br>잠시만 기다려주십시오.");
			minitalk.socket.sendProtocol("invite",null);
		}
	},
	/**
	 * 대국자 정보를 업데이트한다.
	 */
	updatePlayers:function() {
		var $janggi = $("div[data-role=janggi]");
		var $player = $("div[data-role=player]",$janggi);
		
		var $han = $("div.han > label",$player);
		if ($("b",$han).length == 0) {
			$han.append($("<b>").html(me.game.status.han.user.nickname));
		} else {
			$("b",$han).html(me.game.status.han.user.nickname);
		}
		if ($("i",$han).length == 0) {
			$han.append($("<i>").html(me.game.status.han.data.win + "승 " + me.game.status.han.data.lose + "패"));
		} else {
			$("i",$han).html(me.game.status.han.data.win + "승 " + me.game.status.han.data.lose + "패");
		}
		if ($("small",$han).length == 0) {
			$han.append($("<small>").html("기물점수 : <u>74</u>점</small>"));
		} else {
			$("small",$han).html("기물점수 : <u>74</u>점</small>");
		}
		
		var $cho = $("div.cho > label",$player);
		if ($("b",$cho).length == 0) {
			$cho.append($("<b>").html(me.game.status.cho.user.nickname));
		} else {
			$("b",$cho).html(me.game.status.cho.user.nickname);
		}
		if ($("i",$cho).length == 0) {
			$cho.append($("<i>").html(me.game.status.cho.data.win + "승 " + me.game.status.cho.data.lose + "패"));
		} else {
			$("i",$cho).html(me.game.status.cho.data.win + "승 " + me.game.status.cho.data.lose + "패");
		}
		if ($("small",$cho).length == 0) {
			$cho.append($("<small>").html("기물점수 : <u>74</u>점</small>"));
		} else {
			$("small",$cho).html("기물점수 : <u>74</u>점</small>");
		}
	},
	/**
	 * 대국상태를 갱신한다.
	 */
	updateStatus:function() {
		// 내가 대국중이라면, 나의 팀을 아래에 배치하거나, 대국중이 아닌 경우 초나라를 아래쪽에 배치한다.
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		$board.removeClass("han").removeClass("cho").addClass(me.game.team === "han" ? "han" : "cho");
		
		// 대국자를 업데이트 한다.
		me.game.updatePlayers();
		
		if (me.game.step == 5) {
			me.game.pauseGame();
			return;
		} else if (me.game.step < 10) {
			if (me.game.team == null) {
				me.game.printMessage("대국시작 대기중...","아직 대국이 시작되지 않았습니다.<br>대국이 시작되면 관전할 수 있습니다.");
			}
			return;
		} else if (me.game.step == 20) {
			if (me.game.team == null) {
				me.game.printMessage("대국종료","대국이 종료되어, 재대국 여부를 결정하고 있습니다.<br>대국이 시작되면 관전할 수 있습니다.");
			}
			return;
		}
		
		// 타이머를 업데이트 한다.
		me.game.updateTimers();
		
		// 기물배치를 업데이트한다.
		me.game.updateStones();
		
		// 턴을 업데이트 한다.
		me.game.updateTurn();
	},
	/**
	 * 타이머를 업데이트한다.
	 */
	updateTimers:function() {
		var $janggi = $("div[data-role=janggi]");
		var $timer = $("div[data-role=timer]",$janggi);
		
		var $han = $("div.han",$timer);
		if ($("b",$han).length == 0) {
			$han.append($("<b>").html(me.game.status.han.timecount));
		} else {
			$("b",$han).html(me.game.status.han.timecount);
		}
		if ($("small",$han).length == 0) {
			$han.append($("<small>").html(me.game.getTime(me.game.status.han.timer)));
		} else {
			$("small",$han).html(me.game.getTime(me.game.status.han.timer));
		}
		
		var $cho = $("div.cho",$timer);
		if ($("b",$cho).length == 0) {
			$cho.append($("<b>").html(me.game.status.cho.timecount));
		} else {
			$("b",$cho).html(me.game.status.cho.timecount);
		}
		if ($("small",$cho).length == 0) {
			$cho.append($("<small>").html(me.game.getTime(me.game.status.cho.timer)));
		} else {
			$("small",$cho).html(me.game.getTime(me.game.status.cho.timer));
		}
		
		if (me.game.status.turn == "han") {
			if (me.game.status.cho.timecounting == true) {
				$("small",$cho).html(me.game.getTime(60));
			}
			
			var remain = me.game.status.han.timer;
		} else {
			if (me.game.status.han.timecounting == true) {
				$("small",$han).html(me.game.getTime(60));
			}
			
			var remain = me.game.status.cho.timer;
		}
		
		if (remain <= 60) {
			var $pin = $("div.clock > i",$timer);
			var rotate = 60 - remain;
			$pin.css("transform","rotate("+rotate * 6+"deg)");
			
			if (remain <= 10) {
				me.game.playSound("count");
			}
			
			if (remain == 0) {
				var remaincount = me.game.status[me.game.status.turn].timecounting == false ? me.game.status[me.game.status.turn].timecount : me.game.status[me.game.status.turn].timecount - 1;
				if (remaincount == 0) {
					me.game.winner(me.game.status.turn == "han" ? "cho" : "han");
					return;
				}
				
				// 초읽기 시작 알림
				me.game.playSound("pass");
				
				if (remaincount == 1) {
					me.game.printAlert("lastcounting","마지막 초읽기 시작");
				} else {
					me.game.printAlert("timecounting","초읽기 시작 (<b>" + remaincount + "<b>회 남음)");
				}
			}
		}
	},
	/**
	 * 턴을 업데이트한다.
	 */
	updateTurn:function(message) {
		var message = message !== false;
		
		var $janggi = $("div[data-role=janggi]");
		var $player = $("div[data-role=player]",$janggi);
		
		$("> div",$player).removeClass("on");
		$("> div." + me.game.status.turn,$player).addClass("on");
		
		// 나의 턴이라면, 나의 턴임을 알린다.
		if (me.game.status.turn == me.game.team) {
			if (message == true) me.game.printAlert("turn","나의 턴입니다.");
			
			// 타이머를 시작한다.
			if (me.game.status[me.game.team].timecounting == true) {
				var remain = 60;
			} else {
				var remain = me.game.status[me.game.team].timer;
			}
			
			me.game.startTimer(remain,function(count) {
				me.game.status[me.game.team].timer = count;
				me.game.updateTimers();
				
				me.game.minitalk.socket.sendProtocol("timer",{
					team:me.game.team,
					timer:me.game.status[me.game.team].timer,
					timecount:me.game.status[me.game.team].timecount,
					timecounting:me.game.status[me.game.team].timecounting
				});
				
				if (count == 0) {
					if (me.game.status[me.game.team].timecounting == true) {
						me.game.status[me.game.team].timecount--;
						if (me.game.status[me.game.team].timecount > 0) {
							me.game.updateTurn(false);
						}
					} else {
						me.game.status[me.game.team].timecounting = true;
						me.game.updateTurn(false);
					}
				}
			});
			
			me.game.setDisabled(false);
		} else {
			me.game.setDisabled(true);
		}
	},
	/**
	 * 기물배치를 업데이트한다.
	 *
	 * @param object move
	 */
	updateStones:function() {
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		
		var stones = me.game.status.stones;
		for (var x=0;x<9;x++) {
			for (var y=0;y<10;y++) {
				var $position = $("div[data-role=position][data-x=" + x + "][data-y=" + y + "]",$board);
				var stone = stones[x][y];
				if (stone == null) {
					$("button[data-role=stone]",$position).remove();
				} else {
					var $stone = $("button",$position);
					if ($stone.length == 0 || $stone.data("stone").idx != stone.idx || $stone.data("stone").team != stone.team) {
						$("button[data-role=stone]",$position).remove();
						var $stone = $("<button>").attr("type","button").attr("data-role","stone").attr("data-team",stone.team).attr("data-type",stone.type).data("stone",stone);
						$stone.on("click",function() {
							me.game.selectStone($(this));
						});
						$position.append($stone);
					}
				}
			}
		}
	},
	/**
	 * 기물을 선택한다.
	 *
	 * @param object $stone
	 */
	selectStone:function($stone) {
		// 나의 기물이 아니거나, 나의 턴이 아닌 경우
		if (me.game.team != $stone.data("stone").team || me.game.status.turn != me.game.team) {
			return;
		}
		
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		var $stones = $("button[data-role=stone]",$board);
		
		$("button[data-role=movable]",$board).remove();
		
		me.game.playSound("select");
		
		if ($stone.hasClass("selected") == true) {
			$stones.removeClass("selected");
			return;
		}
		
		$stones.removeClass("selected");
		$stone.addClass("selected");
		
		var stone = $stone.data("stone");
		var positions = me.game.getMovablePositions(stone);
		
		for (var i=0 ,loop=positions.length;i<loop;i++) {
			var $movable = $("<button>").attr("type","button").attr("data-role","movable").attr("data-x",positions[i].x).attr("data-y",positions[i].y);
			if (positions[i].movable == true) {
				$movable.on("click",function() {
					me.game.selectMovable($stone,parseInt($(this).attr("data-x"),10),parseInt($(this).attr("data-y"),10));
				});
			} else {
				$movable.addClass("disabled");
			}
			$board.append($movable);
		}
	},
	/**
	 * 이동할 위치를 선택한다.
	 */
	selectMovable:function($stone,x,y) {
		var minitalk = me.game.minitalk;
		
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		var $stones = $("button[data-role=stone]",$board);
		
		$("button[data-role=movable]",$board).remove();
		
		var stone = $stone.data("stone");
		var from = {x:parseInt($stone.parent().attr("data-x"),10),y:parseInt($stone.parent().attr("data-y"),10)};
		var to = {x:x,y:y};
		
		// 돌을 실제로 옮긴다.
		me.game.moveStone(stone,from,to);
		
		// 돌을 옮겼음을 서버에 전송한다.
		minitalk.socket.sendProtocol("move",{stone:stone,from:from,to:to});
		
		// 턴을 종료한다.
		me.game.endTurn();
	},
	/**
	 * 기물을 이동한다.
	 *
	 * @param object stone 옮겨질 기물정보
	 * @param object from 이전위치
	 * @param object to 옮겨질위치
	 */
	moveStone:function(stone,from,to) {
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		var $stones = $("button[data-role=stone]",$board);
		
		$stones.removeClass("moved");
		
		var sound = "move";
		var winner = null;
		
		// 이동할 위치에 상대방 기물이 존재하는지 확인한다.
		var oStone = me.game.getStoneByPosition(to.x,to.y);
		if (oStone != null && oStone.team != stone.team) {
			if (oStone.type == "king") {
				winner = stone.team;
				sound = "attack3";
			} else if (oStone.type == "cha" || oStone.type == "po") {
				sound = "attack2";
			} else {
				sound = "attack1";
			}
		}
		
		me.game.status.stones[from.x][from.y] = null;
		me.game.status.stones[to.x][to.y] = stone;
		
		me.game.updateStones();
		
		var $nStone = $("div[data-role=position][data-x=" + to.x + "][data-y=" + to.y + "] > button[data-role=stone]",$board);
		$nStone.addClass("moved");
		
		if (me.game.checkJang(stone.team) == true) {
			sound = "attack3";
			
			// 외통수인지 확인한다.
			if (me.game.checkEndJang(stone.team) == true) {
				me.game.printAlert("endjang");
				me.game.stopTimer();
				setTimeout(function(team) { me.game.winner(team); },3000,stone.team);
			} else {
				me.game.printAlert("jang");
			}
		}
		
		me.game.playSound(sound);
		
		if (winner != null) {
			me.game.winner(winner);
		}
	},
	checkEndJang:function(team) {
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		
		// 상대방의 모든 기물의 이동가능한 좌표를 가져온다.
		var stones = JSON.parse(JSON.stringify(me.game.status.stones));
		for (var x=0;x<9;x++) {
			for (var y=0;y<10;y++) {
				var stone = stones[x][y];
				if (stone == null || stone.team == team) continue;
				
				var positions = me.game.getMovablePositions(stone);
				for (var i=0, loop=positions.length;i<loop;i++) {
					if (positions[i].movable == true) return false;
				}
			}
		}
		
		return true;
	},
	/**
	 * 장군인지 확인한다.
	 */
	checkJang:function(team,map) {
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		
		// 해당팀의 남아있는 모든 기물을 가져온다.
		var stones = map ? map : JSON.parse(JSON.stringify(me.game.status.stones));
		for (var x=0;x<9;x++) {
			for (var y=0;y<10;y++) {
				var stone = stones[x][y];
				if (stone == null || stone.team != team) continue;
				
				var positions = me.game.getMovablePositions(stone,map);
				
				for (var i=0, loop=positions.length;i<loop;i++) {
					if (stones[positions[i].x][positions[i].y] != null && stones[positions[i].x][positions[i].y].team != team && stones[positions[i].x][positions[i].y].type == "king") {
						return true;
					}
				}
			}
		}
		
		return false;
	},
	/**
	 * 특정좌표에 존재하는 기물이 있는지 확인한다.
	 *
	 * @param int x
	 * @param int y
	 * @return object stone
	 */
	getStoneByPosition:function(x,y,map) {
		var map = map ? map : me.game.status.stones;
		return map[x][y];
	},
	/**
	 * 특정좌표에 존재하는 기물의 팀을 확인한다.
	 *
	 * @param int x
	 * @param int y
	 * @return string team
	 */
	getTeamByPosition:function(x,y,map) {
		var stone = me.game.getStoneByPosition(x,y,map);
		return stone == null ? null : stone.team;
	},
	/**
	 * 기물의 좌표를 가져온다.
	 *
	 * @param object stone
	 * @param object map
	 */
	getStonePosition:function(stone,map) {
		var stones = map ? map : me.game.status.stones;
		for (var x=0;x<=8;x++) {
			for (var y=0;y<=9;y++) {
				if (stones[x][y] != null && stones[x][y].team == stone.team && stones[x][y].idx == stone.idx) {
					return {x:x,y:y};
				}
			}
		}
		
		return null;
	},
	/**
	 * 장기말이 움직일 수 있는 모든 위치를 가져온다.
	 *
	 * @param object stone
	 */
	getMovablePositions:function(stone,map) {
		// 기물의 좌표를 가져온다
		var position = me.game.getStonePosition(stone,map);
		if (position == null) return [];
		
		var x = position.x;
		var y = position.y;
		
		var positions = [];
		var type = stone.type;
		var team = stone.team;
		var enemy = team == "han" ? "cho" : "han";
		
		// 쫄 (쫄이 이동할 수 있는 범위내 나의 기물이 없는 경우)
		if (type == "jol") {
			// 좌측으로 이동
			if (x != 0 && me.game.getTeamByPosition(x-1,y,map) != team) {
				positions.push({x:x-1,y:y});
			}
			
			// 우측으로 이동
			if (x != 8 && me.game.getTeamByPosition(x+1,y,map) != team) {
				positions.push({x:x+1,y:y});
			}
			
			// 팀이 한나라인 경우 아래로만 이동가능하고, 팀이 초나라인 경우 위로만 이동가능하다.
			if (stone.team == "han") {
				// 아래로 이동
				if (y != 9 && me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				
				// 왕 위치인 경우 대각선 이동을 허용한다.
				if (x == 3 && y == 7 && me.game.getTeamByPosition(x+1,y+1,map) != team) {
					positions.push({x:x+1,y:y+1});
				}
				if (x == 5 && y == 7 && me.game.getTeamByPosition(x-1,y+1,map) != team) {
					positions.push({x:x-1,y:y+1});
				}
				if (x == 4 && y == 8) {
					if (me.game.getTeamByPosition(x-1,y+1,map) != team) {
						positions.push({x:x-1,y:y+1});
					}
					if (me.game.getTeamByPosition(x+1,y+1,map) != team) {
						positions.push({x:x+1,y:y+1});
					}
				}
			} else {
				// 위로 이동
				if (y != 0 && me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
				
				// 왕 위치인 경우 대각선 이동을 허용한다.
				if (x == 3 && y == 2 && me.game.getTeamByPosition(x+1,y-1,map) != team) {
					positions.push({x:x+1,y:y-1});
				}
				if (x == 5 && y == 2 && me.game.getTeamByPosition(x-1,y-1,map) != team) {
					positions.push({x:x-1,y:y-1});
				}
				if (x == 4 && y == 1) {
					if (me.game.getTeamByPosition(x-1,y-1,map) != team) {
						positions.push({x:x-1,y:y-1});
					}
					if (me.game.getTeamByPosition(x+1,y-1,map) != team) {
						positions.push({x:x+1,y:y-1});
					}
				}
			}
		}
		
		// 마 (마가 움직이는 경로상에 기물이 없고, 마가 이동할 수 있는 범위내에 나의 기물이 없는 경우)
		if (type == "ma") {
			// 상 -> 좌
			if (x >= 1 && y >= 2 && me.game.getTeamByPosition(x,y-1,map) == null && me.game.getTeamByPosition(x-1,y-2,map) != team) {
				positions.push({x:x-1,y:y-2});
			}
			
			// 상 -> 우
			if (x <= 7 && y >= 2 && me.game.getTeamByPosition(x,y-1,map) == null && me.game.getTeamByPosition(x+1,y-2,map) != team) {
				positions.push({x:x+1,y:y-2});
			}
			
			// 좌 -> 상
			if (x >= 2 && y >= 1 && me.game.getTeamByPosition(x-1,y,map) == null && me.game.getTeamByPosition(x-2,y-1,map) != team) {
				positions.push({x:x-2,y:y-1});
			}
			
			// 좌 -> 하
			if (x >= 2 && y <= 8 && me.game.getTeamByPosition(x-1,y,map) == null && me.game.getTeamByPosition(x-2,y+1,map) != team) {
				positions.push({x:x-2,y:y+1});
			}
			
			// 우 -> 상
			if (x <= 6 && y >= 1 && me.game.getTeamByPosition(x+1,y,map) == null && me.game.getTeamByPosition(x+2,y-1,map) != team) {
				positions.push({x:x+2,y:y-1});
			}
			
			// 우 -> 하
			if (x <= 6 && y <= 8 && me.game.getTeamByPosition(x+1,y,map) == null && me.game.getTeamByPosition(x+2,y+1,map) != team) {
				positions.push({x:x+2,y:y+1});
			}
			
			// 하 -> 좌
			if (x >= 1 && y <= 7 && me.game.getTeamByPosition(x,y+1,map) == null && me.game.getTeamByPosition(x-1,y+2,map) != team) {
				positions.push({x:x-1,y:y+2});
			}
			
			// 하 -> 우
			if (x <= 7 && y <= 7 && me.game.getTeamByPosition(x,y+1,map) == null && me.game.getTeamByPosition(x+1,y+2,map) != team) {
				positions.push({x:x+1,y:y+2});
			}
		}
		
		// 상 (상이 움직이는 경로상에 기물이 없고, 상이 이동할 수 있는 범위내에 나의 기물이 없는 경우)
		if (type == "sang") {
			// 상 -> 좌
			if (x >= 2 && y >= 3 && me.game.getTeamByPosition(x,y-1,map) == null && me.game.getTeamByPosition(x-1,y-2,map) == null && me.game.getTeamByPosition(x-2,y-3,map) != team) {
				positions.push({x:x-2,y:y-3});
			}
			
			// 상 -> 우
			if (x <= 6 && y >= 3 && me.game.getTeamByPosition(x,y-1,map) == null && me.game.getTeamByPosition(x+1,y-2,map) == null && me.game.getTeamByPosition(x+2,y-3,map) != team) {
				positions.push({x:x+2,y:y-3});
			}
			
			// 좌 -> 상
			if (x >= 3 && y >= 2 && me.game.getTeamByPosition(x-1,y,map) == null && me.game.getTeamByPosition(x-2,y-1,map) == null && me.game.getTeamByPosition(x-3,y-2,map) != team) {
				positions.push({x:x-3,y:y-2});
			}
			
			// 좌 -> 하
			if (x >= 3 && y <= 7 && me.game.getTeamByPosition(x-1,y,map) == null && me.game.getTeamByPosition(x-2,y+1,map) == null && me.game.getTeamByPosition(x-3,y+2,map) != team) {
				positions.push({x:x-3,y:y+2});
			}
			
			// 우 -> 상
			if (x <= 5 && y >= 2 && me.game.getTeamByPosition(x+1,y,map) == null && me.game.getTeamByPosition(x+2,y-1,map) == null && me.game.getTeamByPosition(x+3,y-2,map) != team) {
				positions.push({x:x+3,y:y-2});
			}
			
			// 우 -> 하
			if (x <= 5 && y <= 7 && me.game.getTeamByPosition(x+1,y,map) == null && me.game.getTeamByPosition(x+2,y+1,map) == null && me.game.getTeamByPosition(x+3,y+2,map) != team) {
				positions.push({x:x+3,y:y+2});
			}
			
			// 하 -> 좌
			if (x >= 2 && y <= 7 && me.game.getTeamByPosition(x,y+1,map) == null && me.game.getTeamByPosition(x-1,y+2,map) == null && me.game.getTeamByPosition(x-2,y+3,map) != team) {
				positions.push({x:x-2,y:y+3});
			}
			
			// 하 -> 우
			if (x <= 6 && y <= 7 && me.game.getTeamByPosition(x,y+1,map) == null && me.game.getTeamByPosition(x+1,y+2,map) == null && me.game.getTeamByPosition(x+2,y+3,map) != team) {
				positions.push({x:x+2,y:y+3});
			}
		}
		
		// 차 (차가 움직이는 경로상에 나의 말이 없는 경우)
		if (type == "cha") {
			// 좌로 이동
			for (var i=x-1;i>=0;i--) {
				if (me.game.getTeamByPosition(i,y,map) == team) {
					break;
				} else {
					positions.push({x:i,y:y});
					if (me.game.getTeamByPosition(i,y,map) != null) break;
				}
			}
			
			// 우로 이동
			for (var i=x+1;i<=8;i++) {
				if (me.game.getTeamByPosition(i,y,map) == team) {
					break;
				} else {
					positions.push({x:i,y:y});
					if (me.game.getTeamByPosition(i,y,map) != null) break;
				}
			}
			
			// 위로 이동
			for (var i=y-1;i>=0;i--) {
				if (me.game.getTeamByPosition(x,i,map) == team) {
					break;
				} else {
					positions.push({x:x,y:i});
					if (me.game.getTeamByPosition(x,i,map) != null) break;
				}
			}
			
			// 아래로 이동
			for (var i=y+1;i<=9;i++) {
				if (me.game.getTeamByPosition(x,i,map) == team) {
					break;
				} else {
					positions.push({x:x,y:i});
					if (me.game.getTeamByPosition(x,i,map) != null) break;
				}
			}
			
			// 왕 위치 (3,0), (3,7)
			if (x == 3 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x+1,y+1,map) != team) {
					positions.push({x:x+1,y:y+1});
				}
				if (me.game.getTeamByPosition(x+1,y+1,map) == null && me.game.getTeamByPosition(x+2,y+2,map) != team) {
					positions.push({x:x+2,y:y+2});
				}
			}
			
			// 왕 위치 (5,0), (5,7)
			if (x == 5 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x-1,y+1,map) != team) {
					positions.push({x:x-1,y:y+1});
				}
				if (me.game.getTeamByPosition(x-1,y+1,map) == null && me.game.getTeamByPosition(x-2,y+2,map) != team) {
					positions.push({x:x-2,y:y+2});
				}
			}
			
			// 왕 위치 (3,2), (3,9)
			if (x == 3 && (y == 2 || y == 9)) {
				if (me.game.getTeamByPosition(x+1,y-1,map) != team) {
					positions.push({x:x+1,y:y-1});
				}
				if (me.game.getTeamByPosition(x+1,y-1,map) == null && me.game.getTeamByPosition(x+2,y-2,map) != team) {
					positions.push({x:x+2,y:y-2});
				}
			}
			
			// 왕 위치 (4,1), (4,8)
			if (x == 4 && (y == 1 || y == 8)) {
				if (me.game.getTeamByPosition(x-1,y-1,map) != team) {
					positions.push({x:x-1,y:y-1});
				}
				if (me.game.getTeamByPosition(x+1,y-1,map) != team) {
					positions.push({x:x+1,y:y-1});
				}
				if (me.game.getTeamByPosition(x-1,y+1,map) != team) {
					positions.push({x:x-1,y:y+1});
				}
				if (me.game.getTeamByPosition(x+1,y+1,map) != team) {
					positions.push({x:x+1,y:y+1});
				}
			}
			
			// 왕 위치 (5,2), (5,9)
			if (x == 5 && (y == 2 || y == 9)) {
				if (me.game.getTeamByPosition(x-1,y-1,map) != team) {
					positions.push({x:x-1,y:y-1});
				}
				if (me.game.getTeamByPosition(x-1,y-1,map) == null && me.game.getTeamByPosition(x-2,y-2,map) != team) {
					positions.push({x:x-2,y:y-2});
				}
			}
		}
		
		// 포 (상대 말이 위치한 곳으로부터 나의 말이나 포가 없는 경우)
		if (type == "po") {
			// 좌
			var isStone = 0;
			for (var i=x-1;i>=0;i--) {
				if (me.game.getStoneByPosition(i,y,map) != null && me.game.getStoneByPosition(i,y,map).type == "po") break;
				
				if (isStone == 1 && me.game.getTeamByPosition(i,y,map) != team) {
					positions.push({x:i,y:y});
					if (me.game.getTeamByPosition(i,y,map) != null) break;
				}
				
				if (me.game.getStoneByPosition(i,y,map) != null) {
					isStone++;
				}
			}
			
			// 우
			isStone = 0;
			for (var i=x+1;i<=8;i++) {
				if (me.game.getStoneByPosition(i,y,map) != null && me.game.getStoneByPosition(i,y,map).type == "po") break;
				
				if (isStone == 1 && me.game.getTeamByPosition(i,y,map) != team) {
					positions.push({x:i,y:y});
					if (me.game.getTeamByPosition(i,y,map) != null) break;
				}
				
				if (me.game.getStoneByPosition(i,y,map) != null) {
					isStone++;
				}
			}
			
			// 위
			isStone = 0;
			for (var i=y-1;i>=0;i--) {
				if (me.game.getStoneByPosition(x,i,map) != null && me.game.getStoneByPosition(x,i,map).type == "po") break;
				
				if (isStone == 1 && me.game.getTeamByPosition(x,i,map) != team) {
					positions.push({x:x,y:i});
					if (me.game.getTeamByPosition(x,i,map) != null) break;
				}
				
				if (me.game.getStoneByPosition(x,i,map) != null) {
					isStone++;
				}
			}
			
			// 아래
			isStone = 0;
			for (var i=y+1;i<=9;i++) {
				if (me.game.getStoneByPosition(x,i,map) != null && me.game.getStoneByPosition(x,i,map).type == "po") break;
				
				if (isStone == 1 && me.game.getTeamByPosition(x,i,map) != team) {
					positions.push({x:x,y:i});
					if (me.game.getTeamByPosition(x,i,map) != null) break;
				}
				
				if (me.game.getStoneByPosition(x,i,map) != null) {
					isStone++;
				}
			}
			
			// 왕 위치 (3,0), (3,7)
			if (x == 3 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x+1,y+1) != null && me.game.getTeamByPosition(x+1,y+1,map).type != "po") {
					positions.push({x:x+2,y:y+2});
				}
			}
			
			// 왕 위치
			if (me.game.getStoneByPosition(4,1,map) != null && me.game.getStoneByPosition(4,1,map).type != "po") {
				if (x == 3 && y == 0 && me.game.getTeamByPosition(5,2,map) != team && (me.game.getStoneByPosition(5,2,map) == null || me.game.getStoneByPosition(5,2,map).type != "po")) {
					positions.push({x:5,y:2});
				}
				
				if (x == 5 && y == 0 && me.game.getTeamByPosition(3,2,map) != team && (me.game.getStoneByPosition(3,2,map) == null || me.game.getStoneByPosition(3,2,map).type != "po")) {
					positions.push({x:3,y:2});
				}
				
				if (x == 3 && y == 2 && me.game.getTeamByPosition(5,0,map) != team && (me.game.getStoneByPosition(5,0,map) == null || me.game.getStoneByPosition(5,0,map).type != "po")) {
					positions.push({x:5,y:0});
				}
				
				if (x == 5 && y == 2 && me.game.getTeamByPosition(3,0,map) != team && (me.game.getStoneByPosition(3,0,map) == null || me.game.getStoneByPosition(3,0,map).type != "po")) {
					positions.push({x:3,y:0});
				}
			}
			
			// 왕 위치
			if (me.game.getStoneByPosition(4,8,map) != null && me.game.getStoneByPosition(4,8,map).type != "po") {
				if (x == 3 && y == 7 && me.game.getTeamByPosition(5,9,map) != team && (me.game.getStoneByPosition(5,9,map) == null || me.game.getStoneByPosition(5,9,map).type != "po")) {
					positions.push({x:5,y:9});
				}
				
				if (x == 5 && y == 7 && me.game.getTeamByPosition(3,9,map) != team && (me.game.getStoneByPosition(3,9,map) == null || me.game.getStoneByPosition(3,9,map).type != "po")) {
					positions.push({x:3,y:9});
				}
				
				if (x == 3 && y == 9 && me.game.getTeamByPosition(5,7,map) != team && (me.game.getStoneByPosition(5,7,map) == null || me.game.getStoneByPosition(5,7,map).type != "po")) {
					positions.push({x:5,y:7});
				}
				
				if (x == 5 && y == 9 && me.game.getTeamByPosition(3,7,map) != team && (me.game.getStoneByPosition(3,7,map) == null || me.game.getStoneByPosition(3,7,map).type != "po")) {
					positions.push({x:3,y:7});
				}
			}
		}
		
		// 왕 및 사
		if (type == "king" || type == "sa") {
			// 왕 위치 (3,0), (3,7)
			if (x == 3 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				if (me.game.getTeamByPosition(x+1,y+1,map) != team) {
					positions.push({x:x+1,y:y+1});
				}
			}
			
			// 왕 위치 (4,0), (4,7)
			if (x == 4 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
			}
			
			// 왕 위치 (5,0), (5,7)
			if (x == 5 && (y == 0 || y == 7)) {
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				if (me.game.getTeamByPosition(x-1,y+1,map) != team) {
					positions.push({x:x-1,y:y+1});
				}
			}
			
			// 왕 위치 (3,1), (3,8)
			if (x == 3 && (y == 1 || y == 8)) {
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
			}
			
			// 왕 위치 (4,1), (4,8)
			if (x == 4 && (y == 1 || y == 8)) {
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
				if (me.game.getTeamByPosition(x+1,y+1,map) != team) {
					positions.push({x:x+1,y:y+1});
				}
				if (me.game.getTeamByPosition(x-1,y+1,map) != team) {
					positions.push({x:x-1,y:y+1});
				}
				if (me.game.getTeamByPosition(x-1,y-1,map) != team) {
					positions.push({x:x-1,y:y-1});
				}
				if (me.game.getTeamByPosition(x+1,y-1,map) != team) {
					positions.push({x:x+1,y:y-1});
				}
			}
			
			// 왕 위치 (5,1), (5,8)
			if (x == 5 && (y == 1 || y == 8)) {
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x,y+1,map) != team) {
					positions.push({x:x,y:y+1});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
			}
			
			// 왕 위치 (3,2), (3,9)
			if (x == 3 && (y == 2 || y == 9)) {
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
				if (me.game.getTeamByPosition(x+1,y-1,map) != team) {
					positions.push({x:x+1,y:y-1});
				}
			}
			
			// 왕 위치 (4,2), (4,9)
			if (x == 4 && (y == 2 || y == 9)) {
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x+1,y,map) != team) {
					positions.push({x:x+1,y:y});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
			}
			
			// 왕 위치 (5,2), (5,9)
			if (x == 5 && (y == 5 || y == 9)) {
				if (me.game.getTeamByPosition(x-1,y,map) != team) {
					positions.push({x:x-1,y:y});
				}
				if (me.game.getTeamByPosition(x,y-1,map) != team) {
					positions.push({x:x,y:y-1});
				}
				if (me.game.getTeamByPosition(x-1,y-1,map) != team) {
					positions.push({x:x-1,y:y-1});
				}
			}
		}
		
		// 구해진 이동가능한 좌표중, 장군이 되는 좌표를 제거한다.
		if (map === undefined) {
			for (var i=0, loop=positions.length;i<loop;i++) {
				var map = JSON.parse(JSON.stringify(me.game.status.stones));
				map[x][y] = null;
				map[positions[i].x][positions[i].y] = stone;
				if (me.game.checkJang(enemy,map) == true) {
					positions[i].movable = false;
				} else {
					positions[i].movable = true;
				}
			}
		}
		
		return positions;
	},
	/**
	 * 턴을 종료한다.
	 */
	endTurn:function() {
		var minitalk = me.game.minitalk;
		
		// 내 턴이면
		if (me.game.status.turn == me.game.team) {
			me.game.status.turn = me.game.team == "han" ? "cho" : "han";
		} else {
			return;
		}
		
		var $janggi = $("div[data-role=janggi]");
		var $board = $("div[data-role=panel] > div[data-role=board]",$janggi);
		var $stones = $("button[data-role=stone]",$board);
		
		$("button[data-role=movable]",$board).remove();
		$stones.removeClass("selected");
		
		$("button[data-role=movable]",$board).remove();
		
		// 타이머를 중지한다.
		me.game.stopTimer();
		
		// 내가 방장이면
		if (minitalk.box.connection.uuid == minitalk.socket.uuid) {
			minitalk.socket.sendProtocol("status",{step:me.game.step,status:me.game.status});
			me.game.updateStatus();
		} else {
			minitalk.socket.sendProtocol("turn",null);
		}
	},
	/**
	 * 승리여부를 결정한다.
	 *
	 * @param string winner
	 */
	winner:function(winner,is_close) {
		var is_close = is_close === true;
		var minitalk = me.game.minitalk;
		
		me.game.stopTimer();
		
		if (me.game.team == null) {
			var message = me.game.status[winner].user.nickname + "님(" + (winner == "han" ? "한나라" : "초나라") + ")이 대국에서 승리하였습니다.";
		} else {
			// 승리하였을 경우
			if (me.game.team == winner) {
				me.game.playSound("win");
				
				// 전적을 기록한다.
				me.game.data.win = me.game.data.win + 1;
				minitalk.storage("@janggi",me.game.data);
				
				var message = "대국에서 승리하셨습니다.";
			} else {
				me.game.playSound("lose");
				
				// 전적을 기록한다.
				me.game.data.lose = me.game.data.lose + 1;
				minitalk.storage("@janggi",me.game.data);
				
				var message = "대국에서 패배하셨습니다.";
			}
		}
		
		// 재대국이 가능한 경우
		if (is_close == true) {
			me.game.printMessage("대국종료",message + "<br>5초후 자동으로 게임이 종료됩니다.",[{
				text:"지금종료",
				handler:function() {
					self.close();
				}
			}]);
			setTimeout(function() { self.close(); },5000);
		} else if (me.game.step == 10) {
			if (me.game.team == null) {
				message+= "<br>재대국 여부를 결정하고 있습니다. 잠시만 기다려주십시오.";
				me.game.printMessage("대국종료",message,[{
					text:"관전종료",
					handler:function() {
						self.close();
					}
				}]);
			} else {
				// 방장인 경우
				if (minitalk.box.connection.uuid == minitalk.socket.uuid) {
					message+= "<br>상대방과 재대국을 하시겠습니까?";
					me.game.printMessage("대국종료",message,[{
						text:"재대국하기",
						handler:function() {
							me.game.restartGame();
						}
					},{
						text:"대국종료",
						handler:function() {
							self.close();
						}
					}]);
				} else {
					message+= "<br>상대방과 재대국 하시겠습니까?";
					me.game.printMessage("대국종료",message,[{
						text:"재대국하기",
						handler:function() {
							me.game.printMessage("대기중","상대방의 재대국의사를 기다리고 있습니다.<br>잠시만 기다려주십시오.");
						}
					},{
						text:"게임종료",
						handler:function() {
							self.close();
						}
					}]);
				}
			}
		} else {
			message+= "<br>대국자중 한명이 대국을 종료하여 더이상 대국을 진행할 수 없습니다.";
			
			me.game.printMessage("대국종료",message,[{
				text:"대국종료",
				handler:function() {
					self.close();
				}
			}]);
		}
		
		me.game.step = 20;
	},
	/**
	 * 장기판을 비활성화여부를 설정한다.
	 *
	 * @param boolean disabled 비활성화여부
	 */
	setDisabled:function(disabled) {
		var $janggi = $("div[data-role=janggi]");
		var $panel = $("div[data-role=panel]",$janggi);
		var $disabled = $("div[data-role=disabled]",$panel);
		
		if (disabled == true) $disabled.show();
		else $disabled.hide();
	},
	/**
	 * 효과음을 재생한다.
	 *
	 * @param string type 효과음타입
	 */
	playSound:function(type) {
		var $audio = $("audio[data-type="+type+"]");
		if ($audio.length == 0) return;
		
		var audio = $audio.get(0);
		audio.pause();
		audio.currentTime = 0;
		audio.muted = false;
		var promise = audio.play();
		if (promise !== undefined) {
			promise.then(function() {
			}).catch(function(e) {
			});
		}
	}
};

Minitalk.on("init",function(minitalk) {
	/**
	 * 박스가 아닌경우, 박스타입에 장기대전을 추가한다.
	 */
	if (minitalk.box.isBox() == false) {
		var html = [
			'<div data-role="janggi">',
				/**
				 * 장기판
				 */
				'<div data-role="panel"><div data-role="board"></div><div data-role="disabled"></div></div>',
				
				/**
				 * 채팅영역시작
				 */
				'<div data-role="frame">',
			
				/**
				 * 위젯헤더
				 */
				'<header>',
					'<h1>connecting...</h1>', // 위젯타이틀
					'<label data-role="count"></label>', // 접속자수
					'<div data-role="tabs"></div>', // 헤더메뉴 (v6)
				'</header>',
				
				/**
				 * 타이머
				 */
				'<div data-role="timer">',
					'<div class="han"></div>',
					'<div class="clock"><i></i></div>',
					'<div class="cho"></div>',
				'</div>',
				
				/**
				 * 대전자
				 */
				'<div data-role="player">',
					'<div class="han"><label></label></div>',
					'<div class="cho"><label></label></div>',
				'</div>',
			
				/**
				 * 탭바 (v7)
				 */
				'<aside></aside>',
				
				/**
				 * 메인영역
				 */
				'<main></main>',
				
				/**
				 * 위젯푸터
				 */
				'<footer></footer>',
				
				/**
				 * 대국액션버튼
				 */
				'<div data-role="gamebuttons"></div>',
				
				/**
				 * 채팅영역종료
				 */
				'</div>',
				
				/**
				 * 효과음
				 */
				'<audio data-type="attack1"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/attack1.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="attack2"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/attack2.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="attack3"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/attack3.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="button"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/button.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="count"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/count.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="lose"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/lose.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="match"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/match.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="move"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/move.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="pass"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/pass.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="select"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/select.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="start"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/start.mp3" type="audio/mpeg"></audio>',
				'<audio data-type="win"><source src="' + Minitalk.getPluginUrl("janggi") + '/sounds/win.mp3" type="audio/mpeg"></audio>',
			'</div>'
		];
		
		html = html.join("");
		minitalk.box.addType("janggi",me.getText("text/title"),1100,700,html);
	}
	
	/**
	 * 박스이고, 장기대전박스인 경우 장기대전을 초기화한다.
	 */
	if (minitalk.box.isBox() === true && minitalk.box.getType() == "janggi") {
		// 박스 종료모드가 방장종료인 경우, 전체 유저 접속종료로 변경한다. (방장이 대국에서 도망가는 경우를 막기 위함)
		minitalk.box.connection.closemode = "all";
		me.game.init(minitalk);
	}
});