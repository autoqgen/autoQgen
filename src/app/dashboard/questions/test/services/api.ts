const API = "/api";

export async function getCategories() {
  const res = await fetch(`${API}/categories`);

  if (!res.ok) {
    throw new Error("Failed to load categories.");
  }

  return res.json();
}

export async function getSubjects(categoryId: string) {
  const res = await fetch(
    `${API}/subjects?category=${categoryId}`
  );

  if (!res.ok) {
    throw new Error("Failed to load subjects.");
  }

  return res.json();
}

export async function getChapters(subjectId: string) {
  const res = await fetch(
    `${API}/chapters?subject=${subjectId}`
  );

  if (!res.ok) {
    throw new Error("Failed to load chapters.");
  }

  return res.json();
}

export async function getQuestions(filters: {
  category: string;
  subject: string;
  chapter: string;
  type: string;
}) {
  const params = new URLSearchParams(filters);

  const res = await fetch(
    `${API}/questions/test?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to load questions.");
  }

  return res.json();
}