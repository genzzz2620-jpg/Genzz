import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('genzz', {
  connect: (baseUrl: string, code: string) => ipcRenderer.invoke('desktop:connect', baseUrl, code),
  session: (baseUrl: string) => ipcRenderer.invoke('desktop:session', baseUrl),
  activate: (baseUrl: string) => ipcRenderer.invoke('desktop:activate', baseUrl),
  openDashboard: (baseUrl: string, destination?: string, sessionId?: string) => ipcRenderer.invoke('desktop:open-dashboard', baseUrl, destination, sessionId),
  end: (baseUrl: string) => ipcRenderer.invoke('desktop:end', baseUrl),
  detectQuestion: (baseUrl: string, question: string) => ipcRenderer.invoke('desktop:detect-question', baseUrl, question),
  question: (baseUrl: string, question: string, answerId?: string) => ipcRenderer.invoke('desktop:question', baseUrl, question, answerId),
  streamQuestion: (baseUrl: string, question: string, answerId: string | undefined, requestId: string, preferences?: { answerLength: string; answerFormat: string; language: string; aiModel: string }) => ipcRenderer.invoke('desktop:question-stream', baseUrl, question, answerId, requestId, preferences),
  cancelAnswerStream: (requestId: string) => ipcRenderer.send('desktop:question-stream-cancel', requestId),
  onAnswerStream: (callback: (requestId: string, event: Record<string, unknown>) => void) => ipcRenderer.on('desktop:answer-stream', (_event, requestId: string, payload: Record<string, unknown>) => callback(requestId, payload)),
  version: (baseUrl: string, answerId: string, action: string, editedAnswer?: string) => ipcRenderer.invoke('desktop:version', baseUrl, answerId, action, editedAnswer),
  disconnect: (baseUrl: string) => ipcRenderer.invoke('desktop:disconnect', baseUrl),
  forget: () => ipcRenderer.invoke('desktop:forget'),
  allowMicrophone: () => ipcRenderer.invoke('microphone:allow'),
  stopMicrophone: () => ipcRenderer.invoke('microphone:stop'),
  isDev: () => ipcRenderer.invoke('desktop:is-dev'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onTrayAction: (callback: (action: string) => void) => {
    ipcRenderer.on('desktop:reconnect', () => callback('reconnect'));
    ipcRenderer.on('desktop:session-info', () => callback('session-info'));
  },
  onConnectCode: (callback: (code: string) => void) => ipcRenderer.on('desktop:connect-code', (_event, code: string) => callback(code)),
});

