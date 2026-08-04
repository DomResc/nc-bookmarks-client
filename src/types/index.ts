export interface Bookmark {
  id: number;
  title: string;
  url: string;
  tags: string[];
  folders: (string | number)[];
  lastmodified: number;
}

export interface Folder {
  id: number;
  title: string;
  parentFolderId: number;
}

export interface Config {
  serverUrl: string;
  username: string;
  password: string;
}

export type DarkMode = 'light' | 'dark' | 'auto';

export type MessageAction =
  | 'SYNC'
  | 'ADD_BOOKMARK'
  | 'EDIT_BOOKMARK'
  | 'DELETE_BOOKMARK'
  | 'RENAME_FOLDER'
  | 'DELETE_FOLDER'
  | 'CREATE_FOLDER'
  | 'GET_TAB_INFO'
  | 'GET_FAVICON'
  | 'LOGOUT'
  | 'INIT_LOGIN_FLOW'
  | 'CANCEL_LOGIN_FLOW'
  | 'CHECK_LOGIN_NOW';

export interface LoginFlowState {
  serverUrl: string;
  loginUrl: string;
  pollToken: string;
  pollEndpoint: string;
  startedAt: number;
  status: 'pending' | 'complete' | 'timeout' | 'error';
  error?: string;
}

export interface Message {
  action: MessageAction;
  payload?: Record<string, unknown>;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  warning?: string;
  data?: Record<string, unknown>;
}
