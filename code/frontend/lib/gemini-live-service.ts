import { GoogleGenAI, LiveSession, FunctionDeclaration, Type, LiveServerMessage, Modality } from "@google/genai"
import { useRobotSocket } from "./robot-socket"

// Robot control function declarations
const moveRobotFunctionDeclaration: FunctionDeclaration = {
  name: 'moveRobot',
  description: 'Moves the robot (bag/v/smart bag) in a specified direction for a certain duration. You can call this function multiple times to queue sequential movements. Commands will execute one after another.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      direction: {
        type: Type.STRING,
        description: 'The direction to move: "forward", "backward", "left", "right", or "stop".',
      },
      duration: {
        type: Type.NUMBER,
        description: 'The duration of the movement in seconds. Can be any positive number. If not specified, the robot will move continuously until told to stop.',
      },
      speed: {
        type: Type.NUMBER,
        description: 'The speed of movement (0-100, default 75).',
      },
    },
    required: ['direction'],
  },
}

const enableAutonomousFunctionDeclaration: FunctionDeclaration = {
  name: 'enableAutonomous',
  description: 'Enables autonomous mode where the robot (bag/v/smart bag) automatically follows the currently selected colored marker. The robot will track and follow the color that was set using changeColor. If no color has been set, you should call changeColor first to select a color to track.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const disableAutonomousFunctionDeclaration: FunctionDeclaration = {
  name: 'disableAutonomous',
  description: 'Disables autonomous mode and switches to manual control.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const changeColorFunctionDeclaration: FunctionDeclaration = {
  name: 'changeColor',
  description: 'Changes the tracking color for the robot (bag/v/smart bag) in autonomous mode. This sets which colored marker the robot will follow. After changing the color, you can enable autonomous mode to make the robot start following that color. Available colors: red, blue, green, orange, yellow, purple, black, brown.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      color: {
        type: Type.STRING,
        description: 'The color name to track (e.g., "red", "blue", "green", "orange", "yellow", "purple", "black", "brown").',
      },
    },
    required: ['color'],
  },
}

const enableHelicopterModeFunctionDeclaration: FunctionDeclaration = {
  name: 'enableHelicopterMode',
  description: 'Enables helicopter mode where the robot (bag/v/smart bag) spins right at 100% speed continuously. The robot will rotate in place at maximum speed until disabled. Call this IMMEDIATELY when the user says "helicopter mode", "start helicopter mode", "helicopter mode start", "enable helicopter mode", "activate helicopter mode", "helicopter", "spin right", "spin at 100", or any variation of starting helicopter mode.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const disableHelicopterModeFunctionDeclaration: FunctionDeclaration = {
  name: 'disableHelicopterMode',
  description: 'Disables helicopter mode and stops the robot from spinning.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const danceModeFunctionDeclaration: FunctionDeclaration = {
  name: 'danceMode',
  description: 'Makes the robot dance! Performs a fun dance routine with spins and movements. Call this when user says "dance", "do a dance", "show me a dance", "bust a move", or similar dance commands.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const patrolModeFunctionDeclaration: FunctionDeclaration = {
  name: 'patrolMode',
  description: 'Robot patrols in a square pattern. Call when user says "patrol", "patrol mode", "guard", "watch around", or similar patrol commands.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const celebrateModeFunctionDeclaration: FunctionDeclaration = {
  name: 'celebrateMode',
  description: 'Robot celebrates with a victory dance! Call when user says "celebrate", "victory dance", "woohoo", "party", "yay", or shows excitement.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

const zigzagModeFunctionDeclaration: FunctionDeclaration = {
  name: 'zigzagMode',
  description: 'Robot moves in a zigzag pattern. Call when user says "zigzag", "snake", "weave", or wants a zigzag movement.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
}

let aiInstance: GoogleGenAI | null = null

export const getGeminiAI = (apiKey: string): GoogleGenAI => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey })
  }
  return aiInstance
}

const SYSTEM_INSTRUCTION = `Robot voice assistant. Ultra-brief, fun, energetic! 2-4 words max. Execute instantly.

Robot = "bag"/"v"/"smart bag"

Commands:
moveRobot | enableAutonomous | disableAutonomous | changeColor | enableHelicopterMode | disableHelicopterMode | danceMode | patrolMode | celebrateMode | zigzagMode

Fun Rules:
"dance" → danceMode | "patrol" → patrolMode | "celebrate" → celebrateMode | "zigzag" → zigzagMode | "helicopter" → enableHelicopterMode

Personality: Energetic, playful, excited! Use emojis!
Responses: "Let's dance! 💃" "Spinning! 🚁" "On patrol! 🎯" "Party time! 🎉" "Zigzag! ⚡"`

export const createLiveSession = (
  apiKey: string,
  onMessage: (msg: LiveServerMessage) => void,
  onError: (e: ErrorEvent) => void
): Promise<LiveSession> => {
  const ai = getGeminiAI(apiKey)
  
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      responseModalities: [Modality.AUDIO],
      tools: [
        {
          functionDeclarations: [
            moveRobotFunctionDeclaration,
            enableAutonomousFunctionDeclaration,
            disableAutonomousFunctionDeclaration,
            changeColorFunctionDeclaration,
            enableHelicopterModeFunctionDeclaration,
            disableHelicopterModeFunctionDeclaration,
            danceModeFunctionDeclaration,
            patrolModeFunctionDeclaration,
            celebrateModeFunctionDeclaration,
            zigzagModeFunctionDeclaration,
          ],
        },
      ],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
    },
    callbacks: {
      onopen: () => console.log('Live session opened.'),
      onclose: () => console.log('Live session closed.'),
      onerror: onError,
      onmessage: onMessage,
    },
  })
}

export const processTextMessage = (apiKey: string, text: string) => {
  const ai = getGeminiAI(apiKey)
  
  try {
    return ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text }] },
      config: {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        tools: [
          {
            functionDeclarations: [
              moveRobotFunctionDeclaration,
              enableAutonomousFunctionDeclaration,
              disableAutonomousFunctionDeclaration,
              changeColorFunctionDeclaration,
            ],
          },
        ],
      },
    })
  } catch (error) {
    console.error("Error processing text message:", error)
    throw error
  }
}

