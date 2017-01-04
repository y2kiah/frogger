/**
 * A simple Frogger clone for the browser
 * 
 * @author Jeff Kiah
 * @license MIT License
 * @copyright 2017 Jeff Kiah
 */

var tileSize = 50;

var boardLayout = [
    "bridge",
    "log right",
    "turtle left",
    "log right",
    "log right",
    "turtle left",
    "sidewalk",
    "lane",
    "lane",
    "lane",
    "lane",
    "sidewalk"
];

var boardHeight = tileSize * boardLayout.length;
var boardWidth = tileSize * 17;
var board = document.getElementById('board');
board.setAttribute("style", "width:" + boardWidth + "px; height:" + boardHeight + "px");

// Vector2

function Vector2(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector2.prototype = {
    set: function(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    },
    plus: function(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    },
    minus: function(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    },
    times: function(s) {
        this.x *= s;
        this.y *= s;
        return this;
    },
    length: function() {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    },
    normalize: function() {
        var invLength = 1.0 / this.length();
        this.x *= invLength;
        this.y *= invLength;
        return this;
    }
}

Vector2.equal = function(v1, v2) {
    return (v1.x === v2.x && v1.y === v2.y);
}
Vector2.sum = function(v1, v2) {
    return new Vector2(v1.x + v2.x, v1.y + v2.y);
}
Vector2.diff = function(v1, v2) {
    return new Vector2(v1.x - v2.x, v1.y - v2.y);
}
Vector2.mult = function(v, s) {
    return new Vector2(v.x * s, v.y * s);
}


// AABB

var AABB = function (x, y, w, h) {
    this.position = new Vector2(x, y);
    this.width = w;
    this.height = h;
}


// Images pre-load

var images = {
    frog: "frog.png",
    squashedFrog: "squashedFrog.png",
    cars: [ "car.png", "car2.png", "car3.png" ],
    turtle: "turtle.png",
    log: "turtle.png",
    turtle: "turtle.png"
};

for (var key in images) {
    var i = images[key];

    if (Array.isArray(i)) {
        images[key] = i.map(function(s) {
            var img = new Image();
            img.src = s;
            return img;
        });
    }
    else {
        var img = new Image();
        img.src = i;
        images[key] = img;
    }
}


// Frog

function Frog(x, y) {
    this.aabb = new AABB(x, y, 30, 30);
    this.targetPosition = new Vector2(x, y);
    this.angle = 0;
    this.targetAngle = 0;
    this.squashed = false;
    this.ridingOn = null;

    this.img = images.frog.cloneNode(true);
    this.img.className = "frog";

    this.draw();
    board.appendChild(this.img);
}
Frog.prototype = {
    isAtRest: function() {
        return Vector2.equal(this.aabb.position, this.targetPosition);
    },

    update: function(dt) {
        if (this.ridingOn) {
            var step = moveVelocity(this.aabb.position, this.ridingOn.velocity, dt);
            this.targetPosition.x += step.x;

            if (this.aabb.position.x < 0 || this.aabb.position.x + this.aabb.width > boardWidth) {
                game.killFrog();
            }
        }

        if (!this.isAtRest()) {
            move(this.aabb.position, this.targetPosition, Frog.speed, dt);
        }
        if (this.angle !== this.targetAngle) {
            this.angle = rotate(this.angle, this.targetAngle, Frog.rotationSpeed, dt);
        }
    },

    draw: function() {
        this.img.setAttribute("style", "left:" + this.aabb.position.x + "px; top:" + this.aabb.position.y + "px;"
                                + "transform: rotate("+ this.angle +"deg);");
    }
}
Frog.speed = tileSize * 6; // pixels per second
Frog.rotationSpeed = 1080; // degrees per second


// Car

var Car = function (x, y, direction) {
    this.aabb = new AABB(x, y, tileSize*2, tileSize-1);

    this.carImageIndex = Math.floor(Math.random() * images.cars.length);
    this.img = images.cars[this.carImageIndex].cloneNode(true);
    this.img.className = "car" + (direction < 0 ? " left" : "");
    
    var thisCar = this;
    this.img.onload = function() {
        thisCar.aabb.width = this.naturalWidth;
    }

    this.draw();
    board.appendChild(this.img);
}
Car.prototype = {
    draw: function() {
        this.img.setAttribute("style", "left:" + this.aabb.position.x + "px; top:" + this.aabb.position.y + "px;");
    },

    onCollide: function() {
        game.squashFrog();
    }
}


// Lane

var Lane = function (yPosition, direction) {
    this.aabb = new AABB(0, yPosition, boardWidth, tileSize);
    this.speed = Math.round(Math.random() * 4 + 2) * tileSize;
    this.direction = direction;
    this.velocity = new Vector2(this.speed * this.direction, 0);
    this.spacing = Math.round(Math.random() * 6 + 5) * tileSize;
    this.patternSpacing = Math.round(Math.random() * 8 + 4) * tileSize;
    this.patternCount = Math.ceil(Math.random() * 6 + 1);
    this.totalPatternLength = (this.spacing * (this.patternCount - 1)) + this.patternSpacing;

    this.patterns = [];
    this.cars = [];
    this.buildPatterns();

    this.laneDiv = document.createElement("div");
    this.laneDiv.className = "road" + (this.direction < 0 ? " left" : "");
    this.laneDiv.setAttribute("style", "top:"+this.aabb.position.y+"px; height:"+this.aabb.height+"px;");
    board.appendChild(this.laneDiv);
}
Lane.prototype = {
    buildPatterns: function() {
        var numPatterns = Math.ceil(this.aabb.width / this.totalPatternLength) + 1;

        var patternX = 0;
        for (var p = 0; p < numPatterns; ++p) {
            this.patterns.push({
                position: new Vector2(patternX, this.aabb.position.y),
                cars: []
            });
            
            var pattern = this.patterns[this.patterns.length-1];

            var carX = patternX;
            for (var c = 0; c < this.patternCount; ++c) {
                var car = new Car(carX, this.aabb.position.y, this.direction);
                pattern.cars.push(car);
                this.cars.push(car);

                carX += this.spacing;
            }

            // pattern visual debugging
            pattern.patternDiv = document.createElement("div");
            pattern.patternDiv.className = "pattern";
            pattern.color = "rgb("+Math.floor(Math.random() * 255)+","+Math.floor(Math.random() * 255)+","+Math.floor(Math.random() * 255)+")";
            pattern.patternDiv.setAttribute("style", "position: absolute; left:"+pattern.position.x+"px; top:"+pattern.position.y+"px;"
                                            + "width:"+this.totalPatternLength+"px; height:"+tileSize+"px;"
                                            + "background-color:"+pattern.color+";");
            board.appendChild(pattern.patternDiv);

            patternX += this.totalPatternLength;
        }
    },

    update: function(dt) {
        for (var p in this.patterns) {
            var pattern = this.patterns[p];
            var lastX = pattern.position.x;

            // move the pattern
            moveVelocity(pattern.position, this.velocity, dt);

            // wrap the pattern around
            if (this.direction > 0) {
                if (pattern.position.x >= this.aabb.width) {
                    pattern.position.x -= (this.totalPatternLength * (this.patterns.length));
                }
            }
            else if (this.direction < 0 && pattern.position.x <= -this.totalPatternLength) {
                pattern.position.x += (this.totalPatternLength * (this.patterns.length));
            }

            // move all cars in the pattern
            var deltaX = pattern.position.x - lastX;
            for (var c in pattern.cars) {
                var car = pattern.cars[c];
                car.aabb.position.x += deltaX;
            }
        }
    },

    draw: function() {
        for (var p in this.patterns) {
            var pattern = this.patterns[p];
            for (var c in pattern.cars) {
                pattern.cars[c].draw();

                pattern.patternDiv.setAttribute("style", "position: absolute; left:"+pattern.position.x+"px; top:"+pattern.position.y+"px;"
                                            + "width:"+this.totalPatternLength+"px; height:"+tileSize+"px;"
                                            + "background-color:"+pattern.color+";");
            }
        }
    },

    getColliders: function() {
        return this.cars;
    }
}


// River

function River(yPosition, direction, floatClass) {
    this.aabb = new AABB(0, yPosition, boardWidth, tileSize);
    this.speed = Math.round(Math.random() * 2 + 0.5) * tileSize;
    this.direction = direction;
    this.velocity = new Vector2(this.speed * this.direction, 0);
    this.floatLength = Math.ceil(Math.random() * 4 + 1) * tileSize;
    this.floatClass = floatClass;
    this.spacing = Math.ceil(Math.random() * 8 + 4) * tileSize;
    if (this.spacing === this.floatLength) { this.spacing += tileSize; }
    this.patternSpacing = Math.ceil(Math.random() * 8 + 4) * tileSize;
    if (this.patternSpacing === this.floatLength) { this.patternSpacing += tileSize; }

    this.patternCount = Math.ceil(Math.random() * 4);
    this.totalPatternLength = (this.spacing * (this.patternCount - 1)) + this.patternSpacing;

    this.patterns = [];
    this.floaters = [];
    this.buildPatterns();

    this.riverDiv = document.createElement("div");
    this.riverDiv.className = "river";
    this.riverDiv.setAttribute("style", "top:"+this.aabb.position.y+"px; width:"+boardWidth+"px; height:"+tileSize+"px;");
    board.appendChild(this.riverDiv);
}
River.prototype = {
    buildPatterns: function() {
        var numPatterns = Math.ceil(this.aabb.width / this.totalPatternLength) + 1;

        var patternX = 0;
        for (var p = 0; p < numPatterns; ++p) {
            this.patterns.push({
                position: new Vector2(patternX, this.aabb.position.y),
                floaters: []
            });
            
            var pattern = this.patterns[this.patterns.length-1];

            var floaterX = patternX;
            for (var f = 0; f < this.patternCount; ++f) {
                var floater = new Floater(floaterX, this.aabb.position.y, this.floatLength, this.direction, this.floatClass, this.velocity);
                pattern.floaters.push(floater);
                this.floaters.push(floater);

                floaterX += this.spacing;
            }

            // pattern visual debugging
            pattern.patternDiv = document.createElement("div");
            pattern.patternDiv.className = "pattern";
            pattern.color = "rgb("+Math.floor(Math.random() * 255)+","+Math.floor(Math.random() * 255)+","+Math.floor(Math.random() * 255)+")";
            pattern.patternDiv.setAttribute("style", "position: absolute; left:"+pattern.position.x+"px; top:"+pattern.position.y+"px;"
                                            + "width:"+this.totalPatternLength+"px; height:"+tileSize+"px;"
                                            + "background-color:"+pattern.color+";");
            board.appendChild(pattern.patternDiv);

            patternX += this.totalPatternLength;
        }
    },

    update: function(dt) {
        for (var p in this.patterns) {
            var pattern = this.patterns[p];
            var lastX = pattern.position.x;

            // move the pattern
            moveVelocity(pattern.position, this.velocity, dt);

            // wrap the pattern around
            if (this.direction > 0) {
                if (pattern.position.x >= this.aabb.width) {
                    pattern.position.x -= (this.totalPatternLength * (this.patterns.length));
                }
            }
            else if (this.direction < 0 && pattern.position.x <= -this.totalPatternLength) {
                pattern.position.x += (this.totalPatternLength * (this.patterns.length));
            }

            // move all floaters in the pattern
            var deltaX = pattern.position.x - lastX;
            for (var f in pattern.floaters) {
                var floater = pattern.floaters[f];
                floater.aabb.position.x += deltaX;
            }
        }
    },

    draw: function() {
        for (var p in this.patterns) {
            var pattern = this.patterns[p];
            for (var f in pattern.floaters) {
                pattern.floaters[f].draw();

                pattern.patternDiv.setAttribute("style", "position: absolute; left:"+pattern.position.x+"px; top:"+pattern.position.y+"px;"
                                            + "width:"+this.totalPatternLength+"px; height:"+tileSize+"px;"
                                            + "background-color:"+pattern.color+";");
            }
        }
    },

    getColliders: function() {
        return [].concat(this.floaters, this);
    },

    onCollide: function() {
        if (game.frog.isAtRest()) {
            game.splashFrog();
        }
    }
}



// Floater (Turtle and Log)

function Floater(x, y, width, direction, floatClass, velocity) {
    this.aabb = new AABB(x, y, width, tileSize);
    this.velocity = velocity;

    this.div = document.createElement("div");
    this.div.className = floatClass + (direction < 0 ? " left" : "");

    this.draw();
    board.appendChild(this.div);
}
Floater.prototype = {
    draw: function() {
        this.div.setAttribute("style", "left:" + this.aabb.position.x + "px; top:" + this.aabb.position.y + "px; "
                                + "width:" + this.aabb.width + "px; height:" + this.aabb.height + "px;");
    },

    onCollide: function() {
        if (game.frog.isAtRest()) {
            game.frog.ridingOn = this;
        }
    }
}


// Bridge

function Bridge(x, y, width, height) {
    this.aabb = new AABB(x, y, width, height);

    this.targets = [];
    this.buildTargets();

    this.div = document.createElement("div");
    this.div.className = "bridge";

    this.draw();
    board.appendChild(this.div);
}
Bridge.prototype = {
    buildTargets: function() {
        var targetX = tileSize;
        var targetStep = (boardWidth - (tileSize*3)) / 4;

        for (var t = 0; t < 5; ++t) {
            var target = new Target(targetX, this.aabb.position.y, tileSize, tileSize);
            this.targets.push(target);
            targetX += targetStep;
        }
    },
    
    draw: function() {
        this.div.setAttribute("style", "left:" + this.aabb.position.x + "px; top:" + this.aabb.position.y + "px; "
                                + "width:" + this.aabb.width + "px; height:" + this.aabb.height + "px;");
    },

    onCollide: function() {
        if (game.frog.isAtRest()) {
            game.squashFrog();
        }
    },

    getColliders: function() {
        return [].concat(this.targets, this);
    }
}


// Target

function Target(x, y, width, height) {
    this.aabb = new AABB(x, y, width, height);
    this.occupied = false;

    this.div = document.createElement("div");
    this.div.className = "target";

    this.draw();
    board.appendChild(this.div);
}
Target.prototype = {
    draw: function() {
        this.div.setAttribute("style", "left:" + this.aabb.position.x + "px; top:" + this.aabb.position.y + "px; "
                                + "width:" + this.aabb.width + "px; height:" + this.aabb.height + "px;");
    },

    onCollide: function(collisionCode) {
        if (game.frog.isAtRest()) {
            if (collisionCode !== 2) {
                return false;
            }
            if (this.occupied) {
                game.killFrog();
            }
            else {
                this.occupied = true;
                game.nextFrogOrWin();
            }
        }
    }
}


// Collision system

/**
 * returns 2 if aabb1 is fully contained within aabb2
 * returns 1 if aabb1 intersects aabb2
 * returns 0 if aabb1 and aabb2 do not intersect
 */
function collide(aabb1, aabb2) {
    if (aabb1.position.x >= aabb2.position.x && aabb1.position.x + aabb1.width <= aabb2.position.x + aabb2.width
        && aabb1.position.y >= aabb2.position.y && aabb1.position.y + aabb1.height <= aabb2.position.y + aabb2.height)
    {
        return 2;
    }
    else if (aabb1.position.x + aabb1.width > aabb2.position.x && aabb2.position.x + aabb2.width > aabb1.position.x
             && aabb1.position.y + aabb1.height > aabb2.position.y && aabb2.position.y + aabb2.height > aabb1.position.y)
    {
        return 1;
    }
    return 0;
}

function checkCollisions() {
    for (var c in game.colliders) {
        var collider = game.colliders[c];
        var collisionCode = collide(game.frog.aabb, collider.aabb);
        if (collisionCode !== 0) {
            var response = collider.onCollide(collisionCode);
            if (response !== false) {
                return;
            }
        }
    }
}


// Movement system

function moveVelocity(currentPosition, velocity, dt) {
    var step = Vector2.mult(velocity, dt);
    currentPosition.plus(step);
    return step;
}

function move(currentPosition, targetPosition, speed, dt) {
    var direction = Vector2.diff(targetPosition, currentPosition);
    var distanceRemaining = direction.length();
    var stepDistance = speed * dt;
    if (distanceRemaining < stepDistance) {
        currentPosition.set(targetPosition);
    }
    else {
        direction.normalize();
        var step = Vector2.mult(direction, stepDistance);
        currentPosition.plus(step);
    }
}

function rotate(angle, targetAngle, degreesPerSecond, dt) {
    var degrees = degreesPerSecond * dt; 
    
    var theta = targetAngle - angle;
    var diff = Math.abs(theta) % 360;
    diff = diff > 180 ? 360 - diff : diff;
    
    if (degrees > diff) {
        return targetAngle;
    }
    
    var sign = (theta > 0 && theta < 180)
               || (theta <= -180 && theta >= -360) ? 1 : -1;
    
    return (angle + (degrees * sign)) % 360;
}



// Input system

var inputMappings = {
    "keydown": [
        {
            key: "ArrowUp",
            repeat: false,
            handler: (function(e) {
                if (game.frog && game.frog.isAtRest()) {
                    game.frog.targetPosition.y -= tileSize;
                    if (game.frog.targetPosition.y < 0) {
                        game.frog.targetPosition.y += tileSize;
                    }

                    game.frog.targetAngle = 0;
                    game.frog.ridingOn = null;
                }
            })
        },
        {
            key: "ArrowDown",
            repeat: false,
            handler: (function(e) {
                if (game.frog && game.frog.isAtRest()) {
                    game.frog.targetPosition.y += tileSize;
                    if (game.frog.targetPosition.y + game.frog.aabb.height > boardHeight) {
                        game.frog.targetPosition.y -= tileSize;
                    }
                    
                    game.frog.targetAngle = 180;
                    game.frog.ridingOn = null;
                }
            })
        },
        {
            key: "ArrowLeft",
            repeat: false,
            handler: (function(e) {
                if (game.frog && game.frog.isAtRest()) {
                    game.frog.targetPosition.x -= tileSize;
                    if (game.frog.targetPosition.x < 0) {
                        game.frog.targetPosition.x = 10;
                    }
                    
                    game.frog.targetAngle = 270;
                }
            })
        },
        {
            key: "ArrowRight",
            repeat: false,
            handler: (function(e) {
                if (game.frog && game.frog.isAtRest()) {
                    game.frog.targetPosition.x += tileSize;
                    if (game.frog.targetPosition.x + game.frog.aabb.width > boardWidth) {
                        game.frog.targetPosition.x = boardWidth - tileSize + 10;
                    }
                    
                    game.frog.targetAngle = 90;
                }
            })
        }
    ]
};

for (var evt in inputMappings) {
    window.addEventListener(evt, function(e) {
        //console.log(e);
        
        for (var m in inputMappings[evt]) {
            var mapping = inputMappings[evt][m];
            
            if (e.key === mapping.key) {
                if (!e.repeat || mapping.repeat === undefined || mapping.repeat) {
                    mapping.handler(e);
                    break;
                }
            }
        }
    });
}


// Game state

function Game() {
    this.startingPosition = new Vector2((boardWidth - tileSize) * 0.5 + 10,
                                        (boardLayout.length - 1) * tileSize + 10);

    this.drawables = [];
    this.updatables = [];
    this.colliders = [];
    this.lives = 3;
    this.finished = 0;

    this.makeFrog();

    // build game board
    var laneDirection = -1;
    var sidewalkDirection = 1;

    for (var row = 0; row < boardLayout.length; ++row) {
        var rowY = row * tileSize;
        
        switch (boardLayout[row]) {
            case "lane": {
                var lane = new Lane(rowY, laneDirection);
                this.drawables.push(lane);
                this.updatables.push(lane);
                this.colliders = this.colliders.concat(lane.getColliders());
                laneDirection *= -1;
                break;
            }
            case "sidewalk": {
                var sidewalkDiv = document.createElement("div");
                sidewalkDiv.className = "sidewalk" + (sidewalkDirection < 0 ? " down" : "");
                sidewalkDiv.setAttribute("style", "top:"+rowY+"px; height:"+tileSize+"px;");
                sidewalkDirection *= -1;
                board.appendChild(sidewalkDiv);
                break;
            }
            case "turtle left": {
                var river = new River(rowY, -1, "turtle");
                this.drawables.push(river);
                this.updatables.push(river);
                this.colliders = this.colliders.concat(river.getColliders());
                break;
            }
            case "log left": {
                var river = new River(rowY, -1, "log");
                this.drawables.push(river);
                this.updatables.push(river);
                this.colliders = this.colliders.concat(river.getColliders());
                break;
            }
            case "log right": {
                var river = new River(rowY, 1, "log");
                this.drawables.push(river);
                this.updatables.push(river);
                this.colliders = this.colliders.concat(river.getColliders());
                break;
            }
            case "bridge": {
                var bridge = new Bridge(0, rowY, boardWidth, tileSize);
                this.colliders = this.colliders.concat(bridge.getColliders());
                break;
            }
        }
    }
}
Game.prototype = {
    // create new frog at starting position
    makeFrog: (function() {
        this.frog = new Frog(this.startingPosition.x,
                             this.startingPosition.y);
        this.drawables.push(this.frog);
        this.updatables.push(this.frog);
    }),

    squashFrog: (function() {
        // switch picture to squashed frog
        var goner = this.frog;
        this.frog = null;
        goner.squashed = true;
        goner.img.src = images.squashedFrog.src;
        goner.img.className = "frog squashed";
        
        goner.targetAngle = goner.angle; // freeze rotation
        var ten = { x: 10, y:10 };
        if (goner.isAtRest()) {
            goner.aabb.position.minus(ten);
            goner.targetPosition.set(goner.aabb.position);
        }
        else {
            goner.aabb.position.minus(ten);
            goner.targetPosition.minus(ten);
            
            var newStep = Vector2.diff(goner.targetPosition, goner.aabb.position).times(0.5);
            var newTarget = Vector2.sum(goner.aabb.position, newStep);
            goner.targetPosition.set(newTarget);
        }

        this.nextFrogOrGameOver();
    }),

    splashFrog: (function() {
        var goner = this.frog;
        this.frog = null;
        goner.ridingOn = null;
        goner.img.parentNode.removeChild(goner.img);
        this.nextFrogOrGameOver();
    }),

    killFrog: (function() {
        var goner = this.frog;
        this.frog = null;
        goner.ridingOn = null;
        goner.img.parentNode.removeChild(goner.img);
        this.nextFrogOrGameOver();
    }),

    setWin: (function() {
        var h1 = document.createElement("h1");
        h1.innerHTML = "You Win!";
        board.appendChild(h1);
    }),

    setGameOver: (function() {
        var h1 = document.createElement("h1");
        h1.innerHTML = "Game Over";
        board.appendChild(h1);
    }),

    nextFrogOrGameOver: (function() {
        --this.lives;

        if (this.lives == 0) {
            this.setGameOver();
        }
        else {
            this.makeFrog();
        }
    }),

    nextFrogOrWin: (function() {
        ++this.finished;
        this.frog = null;

        if (this.finished === 5) {
            this.setWin();
        }
        else {
            this.makeFrog();
        }
    })
}

var game = new Game();


// Main loop

var lastTime = performance.now();
var frame = function(time) {
    var dt = (time - lastTime) / 1000.0;
    if (dt > 1) { dt = 0; } // skip frame update if paused for long time
    
    // Update objects
    game.updatables.forEach(function(obj) {
        obj.update(dt);
    }, this);

    if (game.frog) {
        checkCollisions();
    }

    // Draw objects
    game.drawables.forEach(function(obj) {
        obj.draw();
    }, this);

    window.requestAnimationFrame(frame);
    lastTime = time;
}
window.requestAnimationFrame(frame);