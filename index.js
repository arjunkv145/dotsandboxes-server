const express = require('express')
const { Server } = require('socket.io')
const http = require('http')
const cors = require('cors')
const port = 3030
const ShortUniqueId = require('short-unique-id')
const uid = new ShortUniqueId({ length: 6, dictionary: 'alpha_upper' })
const gameRooms = []
const initialGameState = {
    started: false,
    gameOver: false,
    turn: 1,
    lines: [
        null, null, null,
        null, null, null, null,
        null, null, null,
        null, null, null, null,
        null, null, null,
        null, null, null, null,
        null, null, null
    ],
    boxes: [
        null, null, null,
        null, null, null,
        null, null, null,
    ]
}
const boxVertices4x4 = [
    [0, 3, 4, 7],
    [1, 4, 5, 8],
    [2, 5, 6, 9],
    [7, 10, 11, 14],
    [8, 11, 12, 15],
    [9, 12, 13, 16],
    [14, 17, 18, 21],
    [15, 18, 19, 22],
    [16, 19, 20, 23]
]

const boxVertices5x5 = [
    [0, 4, 5, 9],
    [1, 5, 6, 10],
    [2, 6, 7, 11],
    [3, 7, 8, 12],

    [9, 13, 14, 18],
    [10, 14, 15, 19],
    [11, 15, 16, 20],
    [12, 16, 17, 21],

    [18, 22, 23, 27],
    [19, 23, 24, 28],
    [20, 24, 25, 29],
    [21, 25, 26, 30],

    [27, 31, 32, 36],
    [28, 32, 33, 37],
    [29, 33, 34, 38],
    [30, 34, 35, 39],
]

const CORS_OPTIONS = {
	origin: 'http://localhost:3005',
	credentials: true
}
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: CORS_OPTIONS
})

app.use(express.json())
app.use(cors(CORS_OPTIONS))

app.get('/', (req, res) => {
    res.send(`Welcome to dots and boxes multiplayer game! ID - ${uid()}`)
})

io.on('connection', socket => {
    console.log(`New user joined - ${socket.id}`)

    socket.on('create_room', playerName => {
        const roomId = uid()
        gameRooms.push({
            roomId,
            players: [
                {
                    playerId: socket.id,
                    playerName,
                    playerScore: 0
                }
            ],
        })
        socket.join(roomId)
        socket.to(roomId).emit('create_room', { gameRoom: gameRooms[index] })
    })

    socket.on('join_room', ({ code: roomId, playerName }) => {
        const index = gameRooms.findIndex(room => room.roomId === roomId)
        socket.join(socket.id)
        if (index === -1) {
            socket.to(socket.id).emit('join_room', { res: 'Room does not exist' })
            socket.leave(socket.id)
            return
        }
        if (gameRooms[index].players.length === 2) {
            socket.to(socket.id).emit('join_room', { res: 'Room does not exist' })
            socket.leave(socket.id)
            return
        }
        gameRooms[index] = {
            ...gameRooms[index],
            player_2: {
                playerId: socket.id,
                playerName,
                playerScore: 0
            }
        }
        socket.join(roomId)
        socket.to(roomId).emit('join_room', { res: 'Room joined', gameRoom: gameRooms[index] })
    })

    socket.on('start_game', ({ roomId }) => {
        const index = gameRooms.findIndex(room => room.roomId === roomId)
        gameRooms[index] = {
            ...gameRooms[index],
            gameState: {
                ...initialGameState,
                started: true
            }
        }
        socket.to(roomId).emit('start_game')
    })

    socket.on('update_game', ({ roomId, lineId }) => {
        const index = gameRooms.findIndex(room => room.roomId === roomId)
        const { players, gameState } = gameRooms[index]
        const { lines, boxes, turn } = gameState
        const checkBox = (lines, [l1, l2, l3, l4]) => {
            if (lines[l1] !== '' && lines[l2] !== '' && lines[l3] !== '' && lines[l4] !== '')
                return true
            return false
        }

        const tempLines = [...lines]
        tempLines[lineId] = `Player ${turn}`

        const tempBoxes = [...boxes]
        const diffCheckBoxes = [...boxes]

        const tempPlayers = [...players]

        for (let i = 0; i < 9; i++) {
            if (tempBoxes[i] === '') {
                const result = checkBox(lines, boxVertices4x4[i])
                tempBoxes[i] = result ? `Player ${turn}` : ''
                tempPlayers[turn - 1].playerScore = result ? tempPlayers[turn - 1].playerScore + 1 : tempPlayers[turn - 1].playerScore
            }
        }

        const gameOver = tempLines.filter(line => line === '').length === 0 ? true : false

        const newGameState = {
            started: !gameOver,
            gameOver,
            turn: JSON.stringify(diffCheckBoxes) === JSON.stringify(tempBoxes) ? turn === 1 ? 2 : 1 : turn,
            lines: [...tempLines],
            boxes: [...tempBoxes]
        }
        gameRooms[index] = {
            ...gameRooms[index],
            players: { ...tempPlayers },
            gameState: { ...newGameState }
        }

        socket.to(roomId).emit('update_game', { gameRoom: gameRooms[index] })
    })

    socket.on('leave_room', ({ roomId, playerName }) => {
        const index = gameRooms.findIndex(room => room.roomId === roomId)
        const { players } = gameRooms[index]

        if (players.length === 1) {
            gameRooms.splice(index, 1)
        } else if (players.length > 1) {
            const playerIndex = gameRooms[index].players.findIndex((player => player.playerName === playerName))
            gameRooms[index].players.splice(playerIndex, 1)
        }
        socket.leave(roomId)
        socket.to(roomId).emit('update_room', { gameRoom: gameRooms[index] })
    })

    socket.on('exit_game', ({ roomId, playerName }) => {
        const index = gameRooms.findIndex(room => room.roomId === roomId)
        const { players } = gameRooms[index]

        const playerIndex = players.findIndex(player => player.playerName === playerName)
        gameRooms[index].players.splice(playerIndex, 1)
        socket.leave(roomId)
        socket.to(roomId).emit('player_left', { gameRoom: gameRooms[index] })
    })

    socket.on('disconnect', () => {
        const roomIndex = gameRooms.findIndex(room => {
            const playerIndex = room.players.findIndex(player => player.playerId === socket.id)
            return playerIndex === -1 ? false : true
        })

        if (roomIndex === -1) {
            return
        }

        const { players } = gameRooms[roomIndex]
        if (gameRooms[roomIndex].gameState.started === false) {
            if (players.length === 1) {
                gameRooms.splice(index, 1)
            } else if (players.length === 2) {
                const playerIndex = gameRooms[index].players.findIndex((player => player.playerId === socket.id))
                gameRooms[index].players.splice(playerIndex, 1)
            }
            socket.leave(roomId)
            socket.to(roomId).emit('update_room', { gameRoom: gameRooms[roomIndex] })
            return
        }

        if (gameRooms[roomIndex].gameState.started === true) {
            const playerIndex = players.findIndex((player => player.playerId === socket.id))
            gameRooms[index].players.splice(playerIndex, 1)
            socket.leave(roomId)
            socket.to(roomId).emit('player_left', { gameRoom: gameRooms[roomIndex] })
            return
        }
    })
})


server.listen(port, () => console.log(`listening at port ${port}`))