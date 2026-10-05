interface DesktopBridge {
  connect(root: string, code: string): Promise<any>;
  session(root: string): Promise<any>;
  activate(root: string): Promise<any>;
  openDashboard(root: string, destination?: 'dashboard' | 'create' | 'history' | 'session', sessionId?: string): Promise<boolean>;
  end(root: string): Promise<any>;
  detectQuestion(root: string, question: string): Promise<any>;
  question(root: string, question: string, answerId?: string): Promise<any>;
  streamQuestion(root: string, question: string, answerId: string | undefined, requestId: string, preferences?: { answerLength: string; answerFormat: string; language: string; aiModel: string }): Promise<boolean>;
  cancelAnswerStream(requestId: string): void;
  onAnswerStream(callback: (requestId: string, event: Record<string, unknown>) => void): void;
  version(root: string, answerId: string, action: string, editedAnswer?: string): Promise<any>;
  disconnect(root: string): Promise<boolean>;
  forget(): Promise<boolean>;
  allowMicrophone(): Promise<boolean>;
  stopMicrophone(): Promise<boolean>;
  isDev(): Promise<boolean>;
  minimize(): void;
  maximize(): void;
  close(): void;
  onTrayAction(callback: (action: string) => void): void;
  onConnectCode(callback: (code: string) => void): void;
}
interface Window { genzz: DesktopBridge }
