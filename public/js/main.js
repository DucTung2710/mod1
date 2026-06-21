(function () {
  document.querySelectorAll(".js-confirm-delete").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const ok = window.confirm("Bạn chắc chắn muốn xóa dịch vụ này?");
      if (!ok) {
        event.preventDefault();
      }
    });
  });
})();
