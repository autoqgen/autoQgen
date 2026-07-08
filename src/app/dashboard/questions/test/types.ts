export interface Category {
  _id: string;
  name: string;
}

export interface Subject {
  _id: string;
  name: string;
}

export interface Chapter {
  _id: string;
  name: string;
}

export interface Option {
  id: string;
  text: string;
}

export interface Answer {
  correctOptions: string[];
}

export interface Question {
  _id: string;

  type: string;

  difficulty: string;
  explanation?: string;
  question: {
    text: string;
  };

  options: Option[];

  answer: Answer;
}
