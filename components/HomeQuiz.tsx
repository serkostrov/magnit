"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatRussianPhone, isCompleteRussianPhone } from "../lib/phone";

const taskOptions = [
  "Упаковка и полиграфия",
  "Мебель и фурнитура",
  "Реклама, стенды и POS",
  "Производство и оснастка",
  "Электроника и приборы",
  "Другая задача",
];

const solutionOptions = [
  "Достаточно «голого» магнита",
  "Нужен магнит с крепёжным элементом",
];

const parameterOptions = [
  "До 1 кг",
  "От 1 до 5 кг",
  "От 5 до 20 кг",
  "Более 20 кг",
  "Вес неизвестен, важны габариты детали",
  "Пока не знаю — нужен подбор",
];

export function HomeQuiz() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [step, setStep] = useState(0);
  const [task, setTask] = useState("");
  const [solution, setSolution] = useState("");
  const [parameters, setParameters] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMountNode(document.getElementById("home-quiz-root"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mountNode) return null;

  const canContinue =
    (step === 0 && Boolean(task)) ||
    (step === 1 && Boolean(solution)) ||
    (step === 2 && Boolean(parameters)) ||
    (step === 3 && isCompleteRussianPhone(phone) && consent);

  function chooseAnswer(setter: (value: string) => void, value: string) {
    setter(value);
    setSubmitError("");
    // Ответы первых трёх шагов сразу переводят пользователя дальше.
    if (step < 3) setStep((current) => current + 1);
  }

  async function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    if (step < 3) {
      setStep((value) => value + 1);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/forms/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "quiz",
          source: "home-quiz",
          task,
          solution,
          parameters,
          phone,
          consent: true,
        }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить заявку");
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Попробуйте ещё раз");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep(0);
    setTask("");
    setSolution("");
    setParameters("");
    setPhone("");
    setConsent(false);
    setSubmitted(false);
    setSubmitError("");
  }

  return createPortal(
    <div className="home-quiz-shell">
      <div className="quiz-progress" aria-label={`Шаг ${step + 1} из 4`}>
        {[0, 1, 2, 3].map((index) => (
          <span
            className={index <= step ? "is-active" : ""}
            key={index}
            aria-hidden="true"
          />
        ))}
        <b>{submitted ? "Готово" : `${step + 1} / 4`}</b>
      </div>

      {submitted ? (
        <div className="quiz-success" aria-live="polite">
          <span>Заявка сохранена</span>
          <h3>Спасибо! Данные для подбора собраны</h3>
          <p>
            Данные сохранены и переданы менеджеру. Он свяжется с вами для
            уточнения вариантов и условий.
          </p>
          <button className="btn btn-cyan" type="button" onClick={restart}>
            Заполнить ещё раз
          </button>
        </div>
      ) : (
        <form className="home-quiz" onSubmit={submitStep}>
          <div className="quiz-step-head">
            <span>Шаг {step + 1}</span>
            {step === 0 && <h3>Какая задача или сценарий применения?</h3>}
            {step === 1 && <h3>Какой тип магнитного решения нужен?</h3>}
            {step === 2 && (
              <h3>Какой вес нужно удерживать или каковы габариты детали?</h3>
            )}
            {step === 3 && <h3>Куда прислать готовую подборку?</h3>}
          </div>

          {step === 0 && (
            <div className="quiz-options">
              {taskOptions.map((option) => (
                <label className="quiz-option" key={option}>
                  <input
                    type="radio"
                    name="task"
                    value={option}
                    checked={task === option}
                    onChange={() => chooseAnswer(setTask, option)}
                    required
                  />
                  <i aria-hidden="true" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="quiz-options quiz-options-two">
              {solutionOptions.map((option) => (
                <label className="quiz-option" key={option}>
                  <input
                    type="radio"
                    name="solution"
                    value={option}
                    checked={solution === option}
                    onChange={() => chooseAnswer(setSolution, option)}
                    required
                  />
                  <i aria-hidden="true" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="quiz-options">
              {parameterOptions.map((option) => (
                <label className="quiz-option" key={option}>
                  <input
                    type="radio"
                    name="parameters"
                    value={option}
                    checked={parameters === option}
                    onChange={() => chooseAnswer(setParameters, option)}
                    required
                  />
                  <i aria-hidden="true" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="quiz-contact">
              <label className="quiz-field">
                <span>Номер телефона</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatRussianPhone(event.target.value))}
                  placeholder="+7 (999) 000-00-00"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={18}
                  required
                  autoFocus
                />
              </label>
              <label className="quiz-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                />
                <span>
                  Принимаю <a href="/privacy">политику конфиденциальности</a>.
                </span>
              </label>
            </div>
          )}

          <div className="quiz-actions">
            {step > 0 ? (
              <button
                className="quiz-back"
                type="button"
                onClick={() => setStep((value) => value - 1)}
              >
                ← Назад
              </button>
            ) : (
              <span />
            )}
            <button
              className="btn btn-cyan"
              type="submit"
              disabled={!canContinue || submitting}
            >
              {submitting ? "Сохраняем…" : step === 3 ? "Получить подборку" : "Далее →"}
            </button>
          </div>
          {submitError && <p className="quiz-error" role="alert">{submitError}</p>}
        </form>
      )}
    </div>,
    mountNode,
  );
}
