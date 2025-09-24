// étend les props RN de base
declare module 'react-native' {
  interface ViewProps { className?: string }
  interface TextProps { className?: string }
  interface ScrollViewProps { className?: string }
  interface ModalProps { className?: string }
  interface KeyboardAvoidingViewProps { className?: string }
}

// étend les composants react-native-paper courants
declare module 'react-native-paper' {
  export interface ButtonProps { className?: string }
  export interface TextInputProps { className?: string }
  export interface IconButtonProps { className?: string }
  export interface TextProps { className?: string }
  export interface CardProps { className?: string }
}

// assure-toi que ce dossier est inclus par TypeScript
export {};
