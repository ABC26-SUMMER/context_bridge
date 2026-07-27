from domain.models import ProfileItem

def demo_profile():
    return [
        ProfileItem("p1", "education.major", "AISW", True, "normal"),
        ProfileItem("p2", "career.goal", "클라우드 엔지니어", True, "normal"),
        ProfileItem("p3", "skills.current", "Python 기초", True, "normal"),
        ProfileItem("p4", "constraints.available_time", "하루 2시간", True, "normal"),
        ProfileItem("p5", "preferences.food", "매운 음식 비선호", True, "normal"),
        ProfileItem("p6", "constraints.mobility", "오래 걷기 어려움", True, "sensitive"),
        ProfileItem("p7", "health.condition", "무릎 관절염", True, "restricted"),
        ProfileItem("p8", "constraints.budget", "2만원", False, "normal"),  # 비활성
    ]
