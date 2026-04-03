class AgentPausedException(Exception):
    """Raised when an agent needs a human response (via ask_question tool)."""

    def __init__(self, question: str):
        self.question = question
        super().__init__(f"Agent paused: {question}")
