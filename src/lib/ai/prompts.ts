export function buildGradingPrompt(
  question: string,
  referenceAnswer: string,
  studentAnswer: string,
  questionType: 'short' | 'long'
): string {
  return `You are a teacher grading a student's answer.

Question: ${question}
Reference answer: ${referenceAnswer}
Student's answer: ${studentAnswer}
Question type: ${questionType}

Grade the student's answer on a scale of 0-100. Consider:
- Accuracy of key concepts
- Completeness relative to the reference answer
${questionType === 'short' ? '- For short answers: exact or near-exact match expected' : '- For long answers: coverage of main points, reasoning quality'}

Respond in this exact JSON format only, with no additional text:
{"score": <number 0-100>, "feedback": "<brief explanation of the grade>", "keyMissing": ["<missed concept 1>", "<missed concept 2>"]}`;
}
